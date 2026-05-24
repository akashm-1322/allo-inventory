"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";

type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  product?: { id: string; name: string; price: number };
  warehouse?: { id: string; name: string; location: string };
}

function Countdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    function update() {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
      if (diff === 0) onExpiredRef.current();
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const urgent = secondsLeft <= 60;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "2rem",
        borderRadius: "16px",
        border: `1px solid ${urgent ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
        background: urgent ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.02)",
        transition: "all 0.5s",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: urgent ? "rgba(252,165,165,0.7)" : "rgba(232,230,223,0.4)",
        }}
      >
        Hold expires in
      </span>
      <span
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: "3rem",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: urgent ? "#fca5a5" : "#e8e6df",
          transition: "color 0.5s",
        }}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      <div
        style={{
          width: "100%",
          height: "3px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(secondsLeft / 600) * 100}%`,
            background: urgent ? "#ef4444" : "#6366f1",
            borderRadius: "2px",
            transition: "width 1s linear, background 0.5s",
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const map: Record<
    ReservationStatus,
    { label: string; color: string; bg: string }
  > = {
    PENDING: { label: "Hold active", color: "#a78bfa", bg: "rgba(99,102,241,0.12)" },
    CONFIRMED: { label: "Confirmed", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
    RELEASED: { label: "Released", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    EXPIRED: { label: "Expired", color: "#f87171", bg: "rgba(239,68,68,0.1)" },
  };
  const { label, color, bg } = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: "100px",
        background: bg,
        color,
        fontSize: "0.78rem",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          animation:
            status === "PENDING" ? "pulse-badge 2s ease-in-out infinite" : "none",
        }}
      />
      {label}
    </span>
  );
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchReservation = useCallback(async () => {
    const res = await fetch(`/api/reservations/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReservation(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActionLoading("confirm");
    setError(null);
    const res = await fetch(`/api/reservations/${id}/confirm`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to confirm.");
      setActionLoading(null);
      fetchReservation(); // Refresh to get latest state
      return;
    }
    setReservation(data);
    setActionLoading(null);
  }

  async function handleCancel() {
    setActionLoading("cancel");
    setError(null);
    const res = await fetch(`/api/reservations/${id}/release`, {
      method: "POST",
    });
    const data = await res.json();
    setReservation(data);
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(232,230,223,0.4)",
        }}
      >
        Loading reservation…
      </div>
    );
  }

  if (notFound || !reservation) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
        }}
      >
        <p style={{ color: "#fca5a5" }}>Reservation not found.</p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#e8e6df",
            cursor: "pointer",
          }}
        >
          Back to products
        </button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isTerminal = ["CONFIRMED", "RELEASED", "EXPIRED"].includes(
    reservation.status
  );

  return (
    <div style={{ maxWidth: "520px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.push("/")}
        style={{
          background: "none",
          border: "none",
          color: "rgba(232,230,223,0.5)",
          cursor: "pointer",
          fontSize: "0.85rem",
          padding: "0 0 1.5rem 0",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ← All products
      </button>

      <div
        style={{
          background: "#141416",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.7rem",
                color: "rgba(232,230,223,0.35)",
                fontFamily: "DM Mono, monospace",
                letterSpacing: "0.06em",
                marginBottom: "4px",
              }}
            >
              RESERVATION
            </p>
            <h1
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {reservation.product?.name ?? "Product"}
            </h1>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Details */}
        <div style={{ padding: "1.5rem" }}>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {[
              ["Warehouse", reservation.warehouse?.name ?? "—"],
              ["Location", reservation.warehouse?.location ?? "—"],
              ["Quantity", String(reservation.quantity)],
              [
                "Unit price",
                reservation.product
                  ? `$${reservation.product.price.toFixed(2)}`
                  : "—",
              ],
              [
                "Total",
                reservation.product
                  ? `$${(reservation.product.price * reservation.quantity).toFixed(2)}`
                  : "—",
              ],
              [
                "Reserved at",
                new Date(reservation.createdAt).toLocaleTimeString(),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(232,230,223,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "3px",
                  }}
                >
                  {label}
                </dt>
                <dd
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    fontFamily:
                      label === "Quantity" ||
                      label === "Total" ||
                      label === "Unit price"
                        ? "DM Mono, monospace"
                        : "inherit",
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Live countdown */}
          {isPending && (
            <div style={{ marginBottom: "1.5rem" }}>
              <Countdown
                expiresAt={reservation.expiresAt}
                onExpired={fetchReservation}
              />
            </div>
          )}

          {/* Confirmed */}
          {reservation.status === "CONFIRMED" && (
            <div
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: "12px",
                padding: "1.25rem",
                textAlign: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>✓</div>
              <p style={{ fontSize: "0.9rem", color: "#4ade80", fontWeight: 600 }}>
                Purchase confirmed!
              </p>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "rgba(74,222,128,0.6)",
                  marginTop: "4px",
                }}
              >
                Your order has been placed successfully.
              </p>
            </div>
          )}

          {/* Released or Expired */}
          {(reservation.status === "RELEASED" ||
            reservation.status === "EXPIRED") && (
            <div
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: "12px",
                padding: "1.25rem",
                textAlign: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
                {reservation.status === "EXPIRED" ? "⏱" : "↩"}
              </div>
              <p
                style={{ fontSize: "0.9rem", color: "#f87171", fontWeight: 600 }}
              >
                {reservation.status === "EXPIRED"
                  ? "Reservation expired"
                  : "Reservation cancelled"}
              </p>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "rgba(248,113,113,0.6)",
                  marginTop: "4px",
                }}
              >
                {reservation.status === "EXPIRED"
                  ? "The hold has been released back to available stock."
                  : "The units have been returned to available stock."}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "0.85rem",
                color: "#fca5a5",
                marginBottom: "1rem",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions — active reservation */}
          {isPending && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "rgba(232,230,223,0.7)",
                  fontSize: "0.9rem",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === "cancel" ? "Cancelling…" : "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background:
                    actionLoading === "confirm"
                      ? "rgba(99,102,241,0.7)"
                      : "#6366f1",
                  color: "#fff",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === "confirm"
                  ? "Confirming…"
                  : "Confirm purchase"}
              </button>
            </div>
          )}

          {/* Actions — terminal state */}
          {isTerminal && (
            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#e8e6df",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Browse more products
            </button>
          )}
        </div>

        {/* Footer — reservation ID */}
        <div
          style={{
            padding: "12px 1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: "0.68rem",
              color: "rgba(232,230,223,0.2)",
              letterSpacing: "0.04em",
            }}
          >
            {reservation.id}
          </span>
        </div>
      </div>
    </div>
  );
}
