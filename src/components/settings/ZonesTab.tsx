import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";

type Zone = { id: string; name: string };

export function ZonesTab() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const z = await api.zones.list();
      setZones(z);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.zones.create(name);
      setNewName("");
      toast.success(`Zone "${name}" added`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (z: Zone) => { setEditingId(z.id); setEditName(z.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await api.zones.update(id, name);
      toast.success("Zone renamed");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (z: Zone) => {
    if (!confirm(`Delete zone "${z.name}"? Users assigned to this zone will keep the label until reassigned.`)) return;
    try {
      await api.zones.remove(z.id);
      toast.success("Zone deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5 pt-2 max-w-2xl">
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <MapPin size={18} className="text-accent" /> Zones
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Geographic zones used to assign Admins and Members. Used in lead routing & dashboards.
        </p>
      </div>

      <Card className="p-3">
        <div className="flex gap-2">
          <Input
            placeholder="New zone name (e.g. HSR Layout)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          />
          <Button onClick={create} disabled={busy || !newName.trim()} className="gap-1.5">
            <Plus size={14} /> Add zone
          </Button>
        </div>
      </Card>

      <div className="space-y-1.5">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && zones.length === 0 && (
          <div className="text-sm text-muted-foreground italic">No zones yet. Add your first zone above.</div>
        )}
        {zones.map((z) => (
          <Card key={z.id} className="p-2.5 flex items-center gap-2">
            {editingId === z.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(z.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                <Button size="sm" variant="ghost" onClick={() => saveEdit(z.id)}><Check size={14} /></Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}><X size={14} /></Button>
              </>
            ) : (
              <>
                <MapPin size={14} className="text-muted-foreground" />
                <span className="flex-1 font-medium text-sm">{z.name}</span>
                <Button size="sm" variant="ghost" onClick={() => startEdit(z)} title="Rename">
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(z)} title="Delete" className="text-destructive">
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
