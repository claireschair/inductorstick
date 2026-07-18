import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function PasswordInput({ id, label, value, onChange, minLength, required }) {
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={id} className="field-label">
      {label}
      <div className="password-input-wrapper">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

export default PasswordInput;