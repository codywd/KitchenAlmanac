"use client";

import { Printer } from "lucide-react";

import styles from "./weekly-menu.module.css";

export function PrintToolbar() {
  return (
    <button className={styles.printButton} onClick={() => window.print()} type="button">
      <Printer size={17} />
      Print
    </button>
  );
}
