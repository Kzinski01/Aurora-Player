export default function EmptyState({ icon, title, subtitle }) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>;
}
