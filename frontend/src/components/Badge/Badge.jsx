import { IMPORTANCE, STATUS } from '../../constants/activity.js';
import './Badge.css';

export default function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ImportanceBadge({ value }) {
  const item = IMPORTANCE[value];
  return item ? <Badge tone={item.tone}>{item.label}</Badge> : null;
}

export function StatusBadge({ value }) {
  const item = STATUS[value];
  return item ? <Badge tone={item.tone}>{item.label}</Badge> : null;
}
