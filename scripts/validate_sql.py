"""Crude sanity check that all single-quoted SQL strings are properly terminated."""
import sys
path = r"C:\Users\switc\Diagly\sql\diagly_seed.sql"
with open(path, encoding="utf-8") as f:
    sql = f.read()

in_str = False
i = 0
n = len(sql)
line = 1
last_str_start = None

while i < n:
    c = sql[i]
    if c == "\n":
        line += 1
    if not in_str:
        if c == "'":
            in_str = True
            last_str_start = line
    else:
        if c == "\\":
            # MySQL default treats backslash as escape -> skip next char
            i += 2
            continue
        if c == "'":
            if i + 1 < n and sql[i + 1] == "'":
                # doubled = escaped quote
                i += 2
                continue
            in_str = False
    i += 1

print(f"file lines: {sql.count(chr(10)) + 1}")
print(f"chars     : {n:,}")
print(f"in_string : {in_str}  (last open at line {last_str_start})")

# count statements
stmts = sql.count(";")
print(f"semicolons: {stmts}")
