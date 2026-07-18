import { useAuth } from "../context/AuthContext";
import "../styles/Home.css";

function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="page">
      <h1>Home</h1>
      {currentUser ? (
        <p>Logged in as {currentUser.email}</p>
      ) : (
        <p>You're not logged in.</p>
      )}
    </div>
  );
}

export default Home;