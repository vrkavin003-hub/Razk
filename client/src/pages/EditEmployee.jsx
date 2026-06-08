import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import EmployeeForm from "../components/EmployeeForm";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

export default function EditEmployee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    api.get(`/employees/${id}`).then(({ data }) => setEmployee(data.employee));
  }, [id]);

  const save = async (payload) => {
    await api.put(`/employees/${id}`, payload);
    toast.success("Employee updated successfully");
    navigate("/employees");
  };

  if (!employee) return <Loading />;

  return (
    <>
      <PageHeader title="Edit Employee" description={`Update ${employee.name}'s employee record.`} />
      <EmployeeForm initialValue={employee} isEdit onSubmit={save} />
    </>
  );
}
