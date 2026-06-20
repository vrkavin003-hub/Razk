const assert = require("assert/strict");
const { EventEmitter } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PassThrough, Readable, Writable } = require("stream");

const { createCloudinaryStreamStorage } = require("../../server/storage/cloudinaryStreamStorage");
const { createLocalDiskStorage } = require("../../server/storage/localDiskStorage");

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

const request = () => {
  const req = new EventEmitter();
  req.get = () => "";
  req.uploadFolder = "images";
  req.user = { _id: "stream-test-user" };
  return req;
};

const file = ({ bytes = jpegBytes, mimetype = "image/jpeg", originalname = "attendance.jpg", stream } = {}) => ({
  mimetype,
  originalname,
  stream: stream || Readable.from([bytes])
});

const handle = (storage, req, uploadFile) =>
  new Promise((resolve, reject) => {
    let callbackCount = 0;
    storage._handleFile(req, uploadFile, (error, result) => {
      callbackCount += 1;
      if (callbackCount > 1) {
        reject(new Error("Storage callback was invoked more than once"));
        return;
      }
      if (error) reject(error);
      else resolve({ callbackCount, result });
    });
  });

const fakeCloudinary = ({ delayMs = 0, fail = false, neverComplete = false, repeatCallback = false } = {}) => {
  const destroyed = [];
  return {
    destroyed,
    uploader: {
      destroy(publicId) {
        destroyed.push(publicId);
        return Promise.resolve({ result: "ok" });
      },
      upload_stream(options, callback) {
        const target = new Writable({
          write(_chunk, _encoding, done) {
            done();
          }
        });
        target.on("finish", () => {
          if (neverComplete) return;
          setTimeout(() => {
            if (fail) {
              callback(new Error("Cloudinary test failure"));
              return;
            }
            const result = {
              public_id: options.public_id,
              secure_url: `https://res.cloudinary.com/test/image/upload/${options.public_id}.jpg`
            };
            callback(null, result);
            if (repeatCallback) callback(null, result);
          }, delayMs);
        });
        return target;
      }
    }
  };
};

const expectError = async (promise, { code, statusCode }) => {
  let error;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, "Expected upload to fail");
  if (code) assert.equal(error.code, code);
  if (statusCode) assert.equal(error.statusCode, statusCode);
};

const run = async () => {
  const cloudinary = fakeCloudinary();
  const cloudStorage = createCloudinaryStreamStorage({
    getClient: () => cloudinary,
    maxBytes: 1024,
    timeoutMs: 1000
  });
  const valid = await handle(cloudStorage, request(), file());
  assert.equal(valid.callbackCount, 1);
  assert.equal(valid.result.provider, "cloudinary");
  assert.equal(valid.result.mimeType, "image/jpeg");
  assert.equal(valid.result.size, jpegBytes.length);
  assert.match(valid.result.publicId, /^razk-hrms\/images\/stream-test-user\//);
  assert.match(valid.result.url, /^https:\/\/res\.cloudinary\.com\//);

  const validFormats = [
    {
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
      mimetype: "image/png",
      originalname: "attendance.png"
    },
    {
      bytes: Buffer.from("RIFF0000WEBP", "ascii"),
      mimetype: "image/webp",
      originalname: "attendance.webp"
    },
    {
      bytes: Buffer.from("GIF89a", "ascii"),
      mimetype: "image/gif",
      originalname: "attendance.gif"
    }
  ];
  for (const format of validFormats) {
    const uploaded = await handle(cloudStorage, request(), file(format));
    assert.equal(uploaded.result.mimeType, format.mimetype);
    assert.equal(uploaded.result.size, format.bytes.length);
  }

  await expectError(
    handle(cloudStorage, request(), file({ bytes: Buffer.from("not-an-image") })),
    { statusCode: 400 }
  );
  await expectError(
    handle(cloudStorage, request(), file({ bytes: Buffer.alloc(0) })),
    { statusCode: 400 }
  );
  await expectError(
    handle(cloudStorage, request(), file({ originalname: "attendance.png" })),
    { statusCode: 400 }
  );
  await expectError(
    handle(cloudStorage, request(), file({ bytes: Buffer.concat([jpegBytes, Buffer.alloc(1024)]) })),
    { code: "LIMIT_FILE_SIZE", statusCode: 413 }
  );
  await expectError(
    handle(createCloudinaryStreamStorage({
      getClient: () => fakeCloudinary({ fail: true }),
      maxBytes: 1024,
      timeoutMs: 1000
    }), request(), file()),
    {}
  );

  const repeatedClient = fakeCloudinary({ repeatCallback: true });
  const repeatedStorage = createCloudinaryStreamStorage({
    getClient: () => repeatedClient,
    maxBytes: 1024,
    timeoutMs: 1000
  });
  let repeatedCallbackCount = 0;
  await new Promise((resolve, reject) => {
    repeatedStorage._handleFile(request(), file(), (error) => {
      repeatedCallbackCount += 1;
      if (error) reject(error);
      else setTimeout(resolve, 10);
    });
  });
  assert.equal(repeatedCallbackCount, 1);

  const timeoutStorage = createCloudinaryStreamStorage({
    getClient: () => fakeCloudinary({ neverComplete: true }),
    maxBytes: 1024,
    timeoutMs: 20
  });
  await expectError(handle(timeoutStorage, request(), file()), {
    code: "UPLOAD_TIMEOUT",
    statusCode: 504
  });

  const abortStream = new PassThrough();
  const abortReq = request();
  const abortPromise = handle(cloudStorage, abortReq, file({ stream: abortStream }));
  abortStream.write(jpegBytes.subarray(0, 4));
  abortReq.emit("aborted");
  abortStream.end();
  await expectError(abortPromise, { code: "UPLOAD_ABORTED", statusCode: 499 });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "razk-streaming-upload-"));
  const previousRoot = process.env.UPLOAD_ROOT;
  process.env.UPLOAD_ROOT = tempRoot;
  try {
    const localStorage = createLocalDiskStorage({ maxBytes: 1024, timeoutMs: 1000 });
    const local = await handle(localStorage, request(), file());
    assert.equal(local.result.provider, "local");
    assert.equal(local.result.size, jpegBytes.length);
    assert.match(local.result.url, /^\/uploads\/images\/stream-test-user\//);
    const savedPath = path.join(tempRoot, local.result.publicId.replace(/^\/uploads\//, ""));
    assert.deepEqual(fs.readFileSync(savedPath), jpegBytes);
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previousRoot;
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }

  const memoryCloudinary = fakeCloudinary();
  const memoryStorage = createCloudinaryStreamStorage({
    getClient: () => memoryCloudinary,
    maxBytes: 5 * 1024 * 1024,
    timeoutMs: 5000
  });
  const reusableChunk = Buffer.alloc(64 * 1024, 1);
  reusableChunk[0] = 0xff;
  reusableChunk[1] = 0xd8;
  reusableChunk[2] = 0xff;
  const makeFiveMbStream = () => Readable.from((function* chunks() {
    for (let index = 0; index < 80; index += 1) yield reusableChunk;
  })());
  const rssBefore = process.memoryUsage().rss;
  let peakRss = rssBefore;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 2);
  await Promise.all(
    Array.from({ length: 10 }, () =>
      handle(memoryStorage, request(), file({ stream: makeFiveMbStream() }))
    )
  );
  clearInterval(sampler);
  const peakDeltaMb = (peakRss - rssBefore) / (1024 * 1024);
  assert.ok(peakDeltaMb < 35, `Streaming peak RSS delta was unexpectedly high: ${peakDeltaMb.toFixed(2)} MB`);

  console.log(`Upload streaming checks passed; 10 x 5 MB peak RSS delta: ${peakDeltaMb.toFixed(2)} MB`);
};

run().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
