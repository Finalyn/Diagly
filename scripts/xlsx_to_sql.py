"""
Convert DIAGLY_FINAL.xlsx -> MySQL/MariaDB seed SQL.

Outputs: sql/diagly_seed.sql

Two tables generated:
  - cfc_catalog       : Feuil1, full hierarchical CFC reference catalog (646 rows)
  - catalog_items  : Feuil2, operational catalog used by the app (~125 items
                        after filtering category headers and the "note" row)

All prices are stored as VARCHAR because the source file mixes pure numbers
with formulas like "120*50% des m2" and "650.- / apt".
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from openpyxl import load_workbook

XLSX     = r"C:\Users\switc\Desktop\DIAGLY_FINAL.xlsx"
OUT_FULL = r"C:\Users\switc\Diagly\sql\diagly_seed.sql"  # CREATE + INSERT, standalone
OUT_DATA = r"C:\Users\switc\Diagly\sql\seed_data.sql"    # INSERT only, for use after Prisma migrate


# ---------------- helpers ----------------

def sql_str(v):
    """Render any cell value as a SQL literal (NULL or 'escaped string')."""
    if v is None:
        return "NULL"
    s = str(v).strip()
    if s == "":
        return "NULL"
    # MySQL default: backslash IS an escape char, so escape both \ and '
    s = s.replace("\\", "\\\\").replace("'", "''")
    return "'" + s + "'"


def sql_int(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return "NULL"
    try:
        return str(int(v))
    except (ValueError, TypeError):
        return "NULL"


def is_blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def code_str(v):
    """Normalize a CFC code to a string ('101', '101.1', '215.2')."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


# ---------------- parse Feuil1 (CFC catalog) ----------------

def parse_feuil1(ws):
    """Yields tuples: (code, label, level, parent_code, tbe, bon, moyen, mauvais, amelio, normes)."""
    rows = list(ws.iter_rows(values_only=True))
    # row 0 = top header (state labels), row 1 = sub-header (Code CFC / Désignation)
    for raw in rows[2:]:
        code = code_str(raw[0])
        label = raw[1]
        if not code or is_blank(label):
            continue

        if "." in code:
            level = 3
            parent_code = code.split(".")[0]
        else:
            n = len(code)
            if n == 1:
                level = 1
                parent_code = None
            else:
                level = 2
                parent_code = code[0]  # chapter is first digit

        yield (
            code, str(label).strip(), level, parent_code,
            raw[2], raw[3], raw[4], raw[5], raw[6], raw[7],
        )


# ---------------- parse Feuil2 (diagnostic items) ----------------

def parse_feuil2(ws):
    """Yields tuples for catalog_items table."""
    rows = list(ws.iter_rows(values_only=True))
    # row 0 = header
    current_category = None
    current_category_cfc = None
    order = 0
    skipped_notes = []

    for idx, raw in enumerate(rows[1:], start=1):
        desc = raw[0]
        cfc  = code_str(raw[1])
        state_cols = raw[2:8]    # 4 states + amelioration + normes (text)
        unit = raw[8]
        qty  = raw[9]
        price_cols = raw[10:16]  # 4 state prices + amelio price + normes price
        scaff = raw[16] if len(raw) > 16 else None

        # fully empty row
        if all(is_blank(v) for v in raw):
            continue

        # detect "note générale" row (long text in col 0, nothing else useful)
        if desc and isinstance(desc, str) and len(desc) > 200 and all(is_blank(v) for v in raw[1:]):
            skipped_notes.append((idx, desc.strip()))
            continue

        # detect category header: col 0 filled, cols 2..16 all blank
        if not is_blank(desc) and all(is_blank(v) for v in state_cols) \
           and is_blank(unit) and is_blank(qty) \
           and all(is_blank(v) for v in price_cols) and is_blank(scaff):
            current_category = str(desc).strip()
            current_category_cfc = cfc
            continue

        # real diagnostic item
        if is_blank(desc):
            continue  # shouldn't happen but guard

        order += 1
        yield (
            order,
            current_category, current_category_cfc,
            str(desc).strip(), cfc,
            state_cols[0], state_cols[1], state_cols[2], state_cols[3],
            state_cols[4], state_cols[5],
            unit, qty,
            price_cols[0], price_cols[1], price_cols[2], price_cols[3],
            price_cols[4], price_cols[5],
            scaff,
        ), skipped_notes


# ---------------- main ----------------

DDL_CFC_CATALOG = """\
DROP TABLE IF EXISTS cfc_catalog;
CREATE TABLE cfc_catalog (
  code              VARCHAR(10)      NOT NULL,
  label             VARCHAR(255)     NOT NULL,
  level             TINYINT UNSIGNED NOT NULL COMMENT '1=chapitre, 2=groupe, 3=position',
  parent_code       VARCHAR(10)      NULL,
  state_tbe         TEXT             NULL COMMENT 'Très bon état',
  state_bon         TEXT             NULL COMMENT 'Bon état',
  state_moyen       TEXT             NULL COMMENT 'État moyen',
  state_mauvais     TEXT             NULL COMMENT 'Mauvais état',
  improvement       TEXT             NULL COMMENT 'Amélioration',
  norms_upgrade     TEXT             NULL COMMENT 'Remise aux normes',
  PRIMARY KEY (code),
  INDEX idx_cfc_parent (parent_code),
  INDEX idx_cfc_level  (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

DDL_CATALOG_ITEMS = """\
DROP TABLE IF EXISTS catalog_items;
CREATE TABLE catalog_items (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  display_order      INT UNSIGNED  NOT NULL,
  category           VARCHAR(150)  NULL  COMMENT 'STRUCTURE / FACADE / FENETRES / ...',
  category_cfc       VARCHAR(10)   NULL,
  description        VARCHAR(255)  NOT NULL,
  cfc_code           VARCHAR(10)   NULL  COMMENT 'lien logique vers cfc_catalog.code',
  work_tbe           TEXT          NULL,
  work_bon           TEXT          NULL,
  work_moyen         TEXT          NULL,
  work_mauvais       TEXT          NULL,
  work_improvement   TEXT          NULL,
  work_norms         TEXT          NULL,
  unit               VARCHAR(100)  NULL  COMMENT 'CHF/m², CHF/pce, Forfait, ...',
  quantity_formula   VARCHAR(255)  NULL  COMMENT 'expression métier pour calculer la quantité',
  price_tbe          VARCHAR(100)  NULL,
  price_bon          VARCHAR(100)  NULL,
  price_moyen        VARCHAR(100)  NULL,
  price_mauvais      VARCHAR(100)  NULL,
  price_improvement  VARCHAR(100)  NULL,
  price_norms        VARCHAR(100)  NULL,
  scaffolding_note   VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  INDEX idx_ci_cfc      (cfc_code),
  INDEX idx_ci_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""


def build_insert_cfc_catalog(rows):
    out = []
    out.append("INSERT INTO cfc_catalog")
    out.append("  (code, label, level, parent_code, state_tbe, state_bon, state_moyen, state_mauvais, improvement, norms_upgrade)")
    out.append("VALUES")
    for i, (code, label, level, parent, tbe, bon, moy, mau, ame, nor) in enumerate(rows):
        sep = "," if i < len(rows) - 1 else ";"
        out.append(f"  ({sql_str(code)}, {sql_str(label)}, {level}, "
                   f"{sql_str(parent)}, {sql_str(tbe)}, {sql_str(bon)}, "
                   f"{sql_str(moy)}, {sql_str(mau)}, {sql_str(ame)}, {sql_str(nor)}){sep}")
    return out


def build_insert_catalog_items(items):
    out = []
    out.append("INSERT INTO catalog_items")
    out.append("  (display_order, category, category_cfc, description, cfc_code,")
    out.append("   work_tbe, work_bon, work_moyen, work_mauvais, work_improvement, work_norms,")
    out.append("   unit, quantity_formula,")
    out.append("   price_tbe, price_bon, price_moyen, price_mauvais, price_improvement, price_norms,")
    out.append("   scaffolding_note)")
    out.append("VALUES")
    for i, it in enumerate(items):
        (order, cat, cat_cfc, desc, cfc,
         w_tbe, w_bon, w_moy, w_mau, w_ame, w_nor,
         unit, qty,
         p_tbe, p_bon, p_moy, p_mau, p_ame, p_nor,
         scaff) = it
        sep = "," if i < len(items) - 1 else ";"
        out.append(f"  ({order}, {sql_str(cat)}, {sql_str(cat_cfc)}, {sql_str(desc)}, {sql_str(cfc)},")
        out.append(f"   {sql_str(w_tbe)}, {sql_str(w_bon)}, {sql_str(w_moy)}, {sql_str(w_mau)}, {sql_str(w_ame)}, {sql_str(w_nor)},")
        out.append(f"   {sql_str(unit)}, {sql_str(qty)},")
        out.append(f"   {sql_str(p_tbe)}, {sql_str(p_bon)}, {sql_str(p_moy)}, {sql_str(p_mau)}, {sql_str(p_ame)}, {sql_str(p_nor)},")
        out.append(f"   {sql_str(scaff)}){sep}")
    return out


def main():
    wb = load_workbook(XLSX, data_only=True, read_only=True)
    os.makedirs(os.path.dirname(OUT_FULL), exist_ok=True)

    # parse both sheets
    cfc_rows = list(parse_feuil1(wb["Feuil1"]))
    items = []
    skipped = []
    for item, skipped_notes in parse_feuil2(wb["Feuil2"]):
        items.append(item)
        skipped = skipped_notes

    ins_cfc   = build_insert_cfc_catalog(cfc_rows)
    ins_items = build_insert_catalog_items(items)

    notes_block = []
    if skipped:
        notes_block.append("-- ============================================================")
        notes_block.append("-- Notes générales du xlsx (lignes ignorées du dump, conservées en commentaire)")
        notes_block.append("-- ============================================================")
        for row_idx, note in skipped:
            for line in note.splitlines():
                notes_block.append(f"-- [Feuil2 row{row_idx}] {line}")

    # ----- FULL : DDL + DML, standalone import -----
    full = []
    full += [
        "-- Diagly — seed SQL généré depuis DIAGLY_FINAL.xlsx",
        "-- Cible : MySQL 5.7+ / MariaDB 10.2+",
        "-- Charset : utf8mb4",
        "-- Usage  : import standalone (DROP + CREATE + INSERT).",
        "--          Pour utiliser avec Prisma migrations, préférer seed_data.sql.",
        "",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
        "-- ============================================================",
        "-- Table 1 : cfc_catalog (catalogue CFC suisse hiérarchique, 646 lignes)",
        "-- ============================================================",
        DDL_CFC_CATALOG,
        "-- ============================================================",
        "-- Table 2 : catalog_items (catalogue opérationnel, ~125 items)",
        "-- ============================================================",
        DDL_CATALOG_ITEMS,
        "-- ============================================================",
        "-- Données : cfc_catalog",
        "-- ============================================================",
    ]
    full += ins_cfc
    full += [
        "",
        "-- ============================================================",
        "-- Données : catalog_items",
        "-- ============================================================",
    ]
    full += ins_items
    full += [""]
    full += notes_block
    full += ["", "SET FOREIGN_KEY_CHECKS = 1;", ""]

    with open(OUT_FULL, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(full))

    # ----- DATA ONLY : INSERTs, for use after Prisma migrate -----
    data = []
    data += [
        "-- Diagly — données seed (INSERTs uniquement) pour cfc_catalog et catalog_items.",
        "-- À exécuter APRÈS `prisma migrate deploy` (les tables doivent exister vides).",
        "",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
        "TRUNCATE TABLE cfc_catalog;",
        "TRUNCATE TABLE catalog_items;",
        "",
    ]
    data += ins_cfc
    data += [""]
    data += ins_items
    data += [""]
    data += notes_block
    data += ["", "SET FOREIGN_KEY_CHECKS = 1;", ""]

    with open(OUT_DATA, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(data))

    print("OK")
    print(f"  cfc_catalog     : {len(cfc_rows)} rows")
    print(f"  catalog_items   : {len(items)} rows")
    print(f"  notes skipped   : {len(skipped)}")
    print(f"  {OUT_FULL}  ({os.path.getsize(OUT_FULL):,} bytes)")
    print(f"  {OUT_DATA}  ({os.path.getsize(OUT_DATA):,} bytes)")


if __name__ == "__main__":
    main()
