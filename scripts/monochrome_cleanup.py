from pathlib import Path
import re
root = Path('client/src')
patterns = [
    (r'\bbg-razk-50/60\b', 'bg-slate-100/60'),
    (r'\bbg-razk-50\b', 'bg-slate-50'),
    (r'\btext-razk-700\b', 'text-slate-900'),
    (r'\btext-razk-600\b', 'text-slate-700'),
    (r'\btext-razk-900\b', 'text-slate-950'),
    (r'\bring-razk-100\b', 'ring-slate-200'),
    (r'\bshadow-razk-600/20\b', 'shadow-slate-300/70'),
    (r'\bbg-razk-600\b', 'bg-slate-700'),
    (r'\bdark:text-blue-50\b', 'dark:text-slate-100'),
    (r'\bdark:text-blue-100\b', 'dark:text-slate-100'),
    (r'\bdark:text-blue-200\b', 'dark:text-slate-300'),
    (r'\bdark:text-blue-300\b', 'dark:text-slate-300'),
    (r'\bdark:border-\[#203e6f\]\b', 'dark:border-slate-700'),
    (r'\bdark:border-\[#24456f\]\b', 'dark:border-slate-700'),
    (r'\bdark:bg-\[#123052\]\b', 'dark:bg-slate-900'),
    (r'\bdark:bg-\[#0c1f3d\]\b', 'dark:bg-slate-900'),
    (r'\bdark:bg-\[#09192e\]\b', 'dark:bg-slate-900'),
    (r'\bdark:bg-\[#123b66\]\b', 'dark:bg-slate-900'),
    (r'\bdark:bg-\[#173b62\]\b', 'dark:bg-slate-800'),
    (r'\bdark:hover:bg-\[#123052\]\b', 'dark:hover:bg-slate-800'),
    (r'\bdark:hover:bg-\[#102a57\]\b', 'dark:hover:bg-slate-800'),
    (r'\bdark:hover:text-rose-300\b', 'dark:hover:text-slate-100'),
    (r'\bhover:text-rose-600\b', 'hover:text-slate-900'),
    (r'\bfocus:ring-rose-100\b', 'focus:ring-slate-200'),
    (r'\bdark:text-amber-200\b', 'dark:text-slate-100'),
    (r'\btext-amber-600\b', 'text-slate-950'),
    (r'\btext-emerald-600\b', 'text-slate-950'),
    (r'\bdark:text-emerald-200\b', 'dark:text-slate-100'),
    (r'\bdark:text-rose-200\b', 'dark:text-slate-100'),
    (r'\bdark:text-indigo-200\b', 'dark:text-slate-100'),
    (r'\bdark:text-sky-200\b', 'dark:text-slate-100'),
    (r'\btext-amber-700\b', 'text-slate-900'),
    (r'\btext-sky-700\b', 'text-slate-900'),
    (r'\btext-indigo-700\b', 'text-slate-900'),
    (r'\btext-rose-700\b', 'text-slate-900'),
    (r'\btext-emerald-700\b', 'text-slate-900'),
    (r'\btext-amber-800\b', 'text-slate-900'),
    (r'\bbg-amber-50\b', 'bg-slate-50'),
    (r'\bborder-amber-200\b', 'border-slate-200'),
    (r'\bbg-rose-50\b', 'bg-slate-50'),
    (r'\bbg-sky-50\b', 'bg-slate-50'),
    (r'\bbg-indigo-50\b', 'bg-slate-50'),
    (r'\bbg-emerald-50\b', 'bg-slate-50'),
    (r'\bdark:bg-blue-950\b', 'dark:bg-slate-800'),
    (r'\bdark:text-blue-950\b', 'dark:text-slate-100'),
    (r'\bdark:ring-blue-800\b', 'dark:ring-slate-700'),
    (r'\bdark:ring-blue-900\b', 'dark:ring-slate-700'),
    (r'\bdark:ring-blue-300\b', 'dark:ring-slate-700'),
    (r'\bhover:bg-razk-50\b', 'hover:bg-slate-100'),
    (r'\btext-razk-600\b', 'text-slate-700'),
    (r'\bborder-razk-100\b', 'border-slate-200'),
    (r'\bdark:border-\[#203e6f\]\b', 'dark:border-slate-700'),
    (r'\bdark:hover:bg-\[#102a57\]\b', 'dark:hover:bg-slate-800'),
    (r'\bdark:bg-\[#09192e\]\b', 'dark:bg-slate-800'),
    (r'\bdark:bg-blue-500\b', 'dark:bg-slate-700'),
    (r'\bbg-emerald-500\b', 'bg-slate-700'),
    (r'\btext-\[#1f3331\]\b', 'text-slate-950'),
    (r'\btext-\[#2f4a47\]\b', 'text-slate-700'),
    (r'\bbg-\[#f9d3bc\]/35\b', 'bg-slate-200/50'),
    (r'\bring-\[#f9d3bc\]/45\b', 'ring-slate-300/50'),
]

file_count = 0
change_count = 0
for path in root.rglob('*'):
    if path.suffix in {'.js', '.jsx', '.ts', '.tsx'}:
        text = path.read_text(encoding='utf-8')
        orig = text
        for pat, repl in patterns:
            text = re.sub(pat, repl, text)
        if text != orig:
            path.write_text(text, encoding='utf-8')
            file_count += 1
            change_count += sum(len(re.findall(pat, orig)) for pat, _ in patterns)
print(f'Edited {file_count} files and applied approx {change_count} pattern matches.')
