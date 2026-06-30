// JSON / CSV file generation + file reading for export & import.

import type { Exercise, Workout } from "@/types";
import { muscleLabel } from "@/types";
import { epley1RM, isValidSet } from "./stats";
import type { BackupV1 } from "@/data/db";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a tick later so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export function downloadJSON(backup: BackupV1) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `charge-backup-${stamp()}.json`);
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV: date, exercice, groupe_musculaire, serie, poids_kg, reps, 1RM_estime */
export function downloadCSV(workouts: Workout[], exercises: Exercise[]) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const rows: string[] = [
    ["date", "exercice", "groupe_musculaire", "serie", "poids_kg", "reps", "1RM_estime"]
      .map(csvCell)
      .join(";"),
  ];
  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const w of sorted) {
    for (const entry of w.entries) {
      const ex = byId.get(entry.exerciseId);
      const name = ex?.name ?? "(supprimé)";
      const muscle = muscleLabel(ex?.primaryMuscle);
      entry.sets.forEach((s, i) => {
        if (!isValidSet(s)) return;
        rows.push(
          [
            w.date,
            name,
            muscle,
            i + 1,
            String(s.weight).replace(".", ","),
            s.reps,
            String(Math.round(epley1RM(s.weight, s.reps) * 10) / 10).replace(".", ","),
          ]
            .map(csvCell)
            .join(";")
        );
      });
    }
  }
  // BOM so Excel reads UTF-8 accents correctly.
  const blob = new Blob(["﻿" + rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `charge-export-${stamp()}.csv`);
}

export function readJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error("Fichier JSON invalide."));
      }
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsText(file);
  });
}
