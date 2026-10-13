import styles from "./App.module.css";

export default function App() {
  return (
    <div className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.title}>Meal Tracker</h1>
        <p className={styles.tagline}>Track lunches and dinners. Know what you owe.</p>
      </div>
    </div>
  );
}
