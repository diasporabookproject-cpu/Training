import { useEffect, useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Exercise, MuscleGroup } from "@/types";
import { muscleLabel } from "@/types";
import { useStore } from "@/data/store";
import {
  exportBackup,
  getLastExportAt,
  importBackup,
  isValidBackup,
  resetAll,
  setLastExportAt,
  storageEstimate,
} from "@/data/db";
import { downloadCSV, downloadJSON, readJSONFile } from "@/lib/backup-file";
import { daysSince } from "@/lib/format";
import { useToast } from "@/components/toast";
import { Button, Card, ConfirmDialog, IconButton, SectionTitle, Sheet, Tag } from "@/components/ui";
import { MuscleSelect } from "@/components/MuscleSelect";

const EXPORT_REMINDER_DAYS = 7;

export function ReglagesTab() {
  const { reload } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [lastExport, setLastExport] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<string>("");
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    getLastExportAt().then(setLastExport);
    storageEstimate().then((est) => {
      if (est?.usage != null) {
        setEstimate(`${(est.usage / 1024 / 1024).toFixed(1)} Mo utilisés`);
      }
    });
  }, []);

  async function handleExportJSON() {
    try {
      const backup = await exportBackup();
      downloadJSON(backup);
      const now = Date.now();
      await setLastExportAt(now);
      setLastExport(now);
      toast("Sauvegarde JSON exportée", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'export", "error");
    }
  }

  async function handleExportCSV() {
    try {
      const backup = await exportBackup();
      downloadCSV(backup.workouts, backup.exercises);
      toast("Export CSV généré", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'export", "error");
    }
  }

  function pickImportFile() {
    fileRef.current?.click();
  }

  async function confirmImport() {
    const file = pendingImport;
    setPendingImport(null);
    if (!file) return;
    try {
      const data = await readJSONFile(file);
      if (!isValidBackup(data)) {
        toast("Fichier de sauvegarde CHARGE invalide.", "error");
        return;
      }
      await importBackup(data);
      await reload();
      toast("Sauvegarde restaurée ✓", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'import", "error");
    }
  }

  const needsBackup =
    lastExport === null || daysSince(lastExport) >= EXPORT_REMINDER_DAYS;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted">Exercices, sauvegardes et données.</p>
      </header>

      {needsBackup && (
        <Card className="border-accent/40 bg-accent-soft p-4">
          <p className="text-sm">
            <span className="font-semibold text-accent">Pense à sauvegarder.</span>{" "}
            {lastExport === null
              ? "Aucun export pour l'instant — exporte un backup JSON pour ne rien perdre."
              : `Dernier export il y a ${daysSince(lastExport)} jours.`}
          </p>
          <Button variant="primary" size="sm" className="mt-3" onClick={handleExportJSON}>
            <Download size={16} /> Exporter maintenant
          </Button>
        </Card>
      )}

      <ExerciseManager />

      <section className="space-y-2">
        <SectionTitle>Sauvegarde</SectionTitle>
        <Card className="divide-y divide-line">
          <Row
            icon={<FileJson size={18} className="text-accent" />}
            title="Exporter en JSON"
            subtitle="Backup complet et réimportable"
            action={
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download size={15} /> JSON
              </Button>
            }
          />
          <Row
            icon={<FileSpreadsheet size={18} className="text-accent" />}
            title="Exporter en CSV"
            subtitle="Pour tableur (une ligne par série)"
            action={
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download size={15} /> CSV
              </Button>
            }
          />
          <Row
            icon={<Upload size={18} className="text-accent" />}
            title="Importer un JSON"
            subtitle="Remplace toutes les données actuelles"
            action={
              <Button variant="outline" size="sm" onClick={pickImportFile}>
                <Upload size={15} /> Importer
              </Button>
            }
          />
        </Card>
        {estimate && (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
            <Database size={12} /> {estimate}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Zone sensible</SectionTitle>
        <Card className="p-4">
          <Button variant="danger" className="w-full" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Réinitialiser toutes les données
          </Button>
        </Card>
      </section>

      <p className="px-1 pb-2 text-center text-[11px] text-muted">
        CHARGE — données stockées localement sur cet appareil.
        <br />
        Catalogue : free-exercise-db (domaine public).
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPendingImport(f);
          e.target.value = "";
        }}
      />

      <ConfirmDialog
        open={pendingImport !== null}
        title="Importer cette sauvegarde ?"
        message="Toutes les données actuelles (séances et exercices) seront remplacées. Cette action est irréversible — exporte un backup avant si besoin."
        confirmLabel="Remplacer"
        danger
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Tout réinitialiser ?"
        message="Séances, exercices et brouillon seront effacés définitivement."
        confirmLabel="Tout effacer"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          try {
            await resetAll();
            await reload();
            toast("Données réinitialisées", "info");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erreur", "error");
          }
        }}
      />
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function ExerciseManager() {
  const { exercises, isExerciseUsed, renameExercise, setExerciseMuscle, removeExercise, createCustom } =
    useStore();
  const toast = useToast();

  const [editing, setEditing] = useState<Exercise | null>(null);
  const [confirmDel, setConfirmDel] = useState<Exercise | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>Mes exercices ({exercises.length})</SectionTitle>
        <Button variant="ghost" size="sm" className="text-accent" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Ajouter
        </Button>
      </div>

      {exercises.length === 0 ? (
        <Card className="p-5 text-center text-sm text-muted">
          Aucun exercice adopté. Ils apparaissent ici dès que tu en utilises un en séance,
          ou ajoute-en un manuellement.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {exercises.map((ex) => {
            const used = isExerciseUsed(ex.id);
            return (
              <div key={ex.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{ex.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Tag>{muscleLabel(ex.primaryMuscle)}</Tag>
                    <Tag>{ex.source === "custom" ? "perso" : "catalogue"}</Tag>
                  </div>
                </div>
                <IconButton variant="ghost" aria-label="Modifier" onClick={() => setEditing(ex)}>
                  <Pencil size={16} className="text-muted" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  aria-label="Supprimer"
                  disabled={used}
                  title={used ? "Utilisé dans une séance — suppression bloquée" : undefined}
                  onClick={() => setConfirmDel(ex)}
                >
                  <Trash2 size={16} className={used ? "text-line" : "text-muted"} />
                </IconButton>
              </div>
            );
          })}
        </Card>
      )}

      <EditExerciseSheet
        exercise={editing}
        onClose={() => setEditing(null)}
        onSave={async (name, muscle) => {
          if (!editing) return;
          try {
            if (name !== editing.name) await renameExercise(editing.id, name);
            if (muscle !== editing.primaryMuscle) await setExerciseMuscle(editing.id, muscle);
            toast("Exercice mis à jour", "success");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erreur", "error");
          }
          setEditing(null);
        }}
      />

      <AddExerciseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (name, muscle) => {
          try {
            await createCustom(name, muscle);
            toast(`« ${name} » ajouté`, "success");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erreur", "error");
          }
          setAddOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDel !== null}
        title="Supprimer l'exercice ?"
        message={confirmDel ? `« ${confirmDel.name} » sera retiré de tes exercices.` : ""}
        confirmLabel="Supprimer"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (confirmDel) {
            try {
              await removeExercise(confirmDel.id);
              toast("Exercice supprimé", "info");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Erreur", "error");
            }
          }
          setConfirmDel(null);
        }}
      />
    </section>
  );
}

function EditExerciseSheet({
  exercise,
  onClose,
  onSave,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onSave: (name: string, muscle: MuscleGroup | null) => void;
}) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);

  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setMuscle(exercise.primaryMuscle);
    }
  }, [exercise]);

  return (
    <Sheet open={exercise !== null} onClose={onClose} title="Modifier l'exercice">
      <label className="mb-1 block px-1 text-xs font-medium text-muted">Nom</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-4 h-12 w-full rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-ink"
      />
      <label className="mb-1 block px-1 text-xs font-medium text-muted">Groupe musculaire</label>
      <MuscleSelect value={muscle} onChange={setMuscle} />
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          <X size={16} /> Annuler
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={name.trim() === ""}
          onClick={() => onSave(name.trim(), muscle)}
        >
          <Check size={16} /> Enregistrer
        </Button>
      </div>
    </Sheet>
  );
}

function AddExerciseSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, muscle: MuscleGroup | null) => void;
}) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setMuscle(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Nouvel exercice perso">
      <label className="mb-1 block px-1 text-xs font-medium text-muted">Nom</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ex. Tirage poulie neutre"
        className="mb-4 h-12 w-full rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-ink placeholder:text-muted"
      />
      <label className="mb-1 block px-1 text-xs font-medium text-muted">Groupe musculaire</label>
      <MuscleSelect value={muscle} onChange={setMuscle} />
      <Button
        variant="primary"
        className="mt-5 w-full"
        disabled={name.trim() === ""}
        onClick={() => onCreate(name.trim(), muscle)}
      >
        <Plus size={18} /> Créer l'exercice
      </Button>
    </Sheet>
  );
}
