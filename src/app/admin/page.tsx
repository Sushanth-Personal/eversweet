"use client";
import { useCallback, useEffect, useState } from "react";
import type { Product, BoxSize } from "@/lib/types";
import type { ContactField } from "@/lib/order-contacts";
import type { ExtOrder } from "./_lib/constants";
import ProductionWorkspace from "./_components/ProductionWorkspace";
import { OrderManagerModal } from "./_components/OrderManagerModal";
import { FlavourSettingsModal } from "./_components/FlavourSettingsModal";
import "./production.css";
export default function AdminPage() {
  const [orders, setOrders] = useState<ExtOrder[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [boxes, setBoxes] = useState<BoxSize[]>([]),
    [settings, setSettings] = useState(false),
    [error, setError] = useState("");
  const [editor, setEditor] = useState<{
    order: ExtOrder | null;
    focus?: ContactField;
    link?: boolean;
  } | null>(null);
  const [createdVersion, setCreatedVersion] = useState(0);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/workspace", {
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setOrders(data.orders);
      setProducts(data.products);
      setBoxes(data.boxes);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="production-app">
      {error && (
        <p role="alert" className="production-feedback">
          {error}
          <button onClick={load}>Try refresh</button>
        </p>
      )}
      <ProductionWorkspace
        orders={orders}
        products={products}
        boxes={boxes}
        createdVersion={createdVersion}
        onOpen={(order, focus) => setEditor({ order, focus })}
        onNew={() => setEditor({ order: null })}
        onLink={() => setEditor({ order: null, link: true })}
        onSettings={() => setSettings(true)}
        onRefresh={load}
      />
      {editor && (
        <OrderManagerModal
          order={editor.order}
          products={products}
          boxes={boxes}
          password=""
          onUpdated={saved => setOrders(current => current.map(o => o.id === saved.id ? {...o, ...saved} : o))}
          focusField={editor.focus}
          linkOnly={editor.link}
          onClose={() => { setEditor(null); void load(); }}
          onSaved={() => {
            if (!editor.order) setCreatedVersion((v) => v + 1);
            setEditor(null);
            void load();
          }}
          onDeleted={() => {
            setEditor(null);
            void load();
          }}
        />
      )}
      {settings && (
        <FlavourSettingsModal
          products={products}
          onClose={() => setSettings(false)}
          onChanged={load}
        />
      )}
    </main>
  );
}
