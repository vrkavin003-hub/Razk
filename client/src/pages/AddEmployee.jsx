import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import EmployeeForm from "../components/EmployeeForm";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

export default function AddEmployee() {
  const navigate = useNavigate();

  const save = async (payload) => {
    await api.post("/employees", payload);
    toast.success("Employee added successfully");
    navigate("/employees");
  };

  return (
    <>
      <PageHeader title="Add Employee" description="Create employee login credentials and HR profile details." />
      <EmployeeForm onSubmit={save} />
    </>
  );
}
