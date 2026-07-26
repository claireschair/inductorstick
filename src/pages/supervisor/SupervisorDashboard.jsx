import { useState } from "react";
import EmployeeGridItem from "../../components/EmployeeGridItem";
import EmployeeDetailModal from "../../components/EmployeeDetailModal";
import mockEmployees from "../../data/mockEmployees";
import "../../styles/SupervisorDashboard.css";

function SupervisorDashboard() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const activeEmployees = mockEmployees.filter((employee) => employee.checkedIn);
  const inactiveEmployees = mockEmployees.filter((employee) => !employee.checkedIn);

  return (
    <div className="supervisor-page">
      <h1>Team Overview</h1>

      <h2 className="section-heading">Checked In</h2>
      <div className="employee-grid">
        {activeEmployees.map((employee) => (
          <EmployeeGridItem
            key={employee.id}
            employee={employee}
            onClick={() => setSelectedEmployee(employee)}
          />
        ))}
      </div>

      <h2 className="section-heading">Not Checked In</h2>
      <div className="employee-grid">
        {inactiveEmployees.map((employee) => (
          <EmployeeGridItem key={employee.id} employee={employee} />
        ))}
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

export default SupervisorDashboard;