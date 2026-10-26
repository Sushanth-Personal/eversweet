"use client";
import { contactAction, type ContactField } from "@/lib/order-contacts";
function ContactIcon({ field }: { field: ContactField }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {field === "phone" ? (
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
      ) : field === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.7" />
        </>
      )}
    </svg>
  );
}
export default function ContactActions({
  values,
  onEdit,
}: {
  values: { phone?: string; insta_id?: string; customer_maps_url?: string };
  onEdit: (field: ContactField) => void;
}) {
  return (
    <div className="production-contacts">
      {(["phone", "instagram", "map"] as ContactField[]).map((field) => {
        const action = contactAction(field, values),
          label =
            field === "phone"
              ? "Call"
              : field === "instagram"
                ? "Instagram"
                : "Map";
        return action.href ? (
          <a
            key={field}
            href={action.href}
            target={field === "phone" ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
          >
            <ContactIcon field={field} />
          </a>
        ) : (
          <button
            key={field}
            className="missing-contact"
            onClick={() => onEdit(field)}
            aria-label={`${label} — add ${field}`}
            title={`Add ${field} to ${label.toLowerCase()}`}
          >
            <ContactIcon field={field} />
            <span className="contact-add" aria-hidden="true">
              +
            </span>
          </button>
        );
      })}
    </div>
  );
}
