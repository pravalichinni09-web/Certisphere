# Visual Guide - UI Standardization

## 🎨 Color Palette Visualization

```
┌─────────────────────────────────────────────────────────┐
│                   STANDARDIZED COLORS                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PRIMARY COLOR (All Buttons & Accents)                 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  #87BAC3 (Teal)                 │
│                                                          │
│  BACKGROUND (All Page Backgrounds)                      │
│  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  #D6F4ED (Light Teal)           │
│                                                          │
│  TEXT DARK (All Headings & Body Text)                  │
│  ░░░░░░░░░░░░░░░░░░░░  #2c3e50 (Dark Blue)            │
│                                                          │
│  TEXT LIGHT (All Labels & Secondary Text)              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  #87BAC3 (Teal)                  │
│                                                          │
│  BORDERS (All Borders & Dividers)                       │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  #87BAC3 (Teal)                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📐 Layout Structure

```
┌───────────────────────────────────────────────────────────┐
│                    NAVBAR (70px)                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │  PADDING: 30px (All Sections)                      │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │                                             │  │  │
│  │  │     MAX-WIDTH: 1400px (CENTERED)           │  │  │
│  │  │                                             │  │  │
│  │  │  • Dashboard Header                         │  │  │
│  │  │  • Stats Grid                               │  │  │
│  │  │  • Cards & Tables                           │  │  │
│  │  │  • Forms                                    │  │  │
│  │  │                                             │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Library

### Card Component
```
┌─────────────────────────────────────┐
│                                     │
│   White Background                  │
│   Border Radius: 12px               │
│   Padding: 24px                     │
│   Shadow: Default                   │
│   Left Border: 5px Teal             │
│                                     │
│   On Hover:                         │
│   → Lift effect (translateY -4px)   │
│   → Larger shadow                   │
│                                     │
└─────────────────────────────────────┘
```

### Button Component
```
PRIMARY BUTTON (Submit/Action)
┌─────────────────────────────────────┐
│    Gradient Blue → Teal             │
│    White Text                       │
│    Padding: 10px 20px               │
│    Border Radius: 8px               │
│                                     │
│    On Hover:                        │
│    → Lift effect                    │
│    → Enhanced shadow                │
└─────────────────────────────────────┘

SECONDARY BUTTON (Cancel)
┌─────────────────────────────────────┐
│    Light Teal Background            │
│    Dark Text                        │
│    Teal Border: 1px                 │
│    Padding: 10px 20px               │
│    Border Radius: 8px               │
│                                     │
│    On Hover:                        │
│    → Darker background              │
└─────────────────────────────────────┘
```

### Table Component
```
┌──────────────────────────────────────────────────────────┐
│  Column 1            │  Column 2            │  Column 3  │  ← Header
│  Background: #D6F4ED                                      │     (Light)
│  Font Weight: 700                                         │     (Bold)
│  Color: #87BAC3                                           │     (Teal)
├──────────────────────────────────────────────────────────┤
│  Data Cell 1         │  Data Cell 2         │  Data 3    │  ← Row
│  Border Bottom: 1px  │                                    │
│  Color: #2c3e50      │                                    │     (Dark)
├──────────────────────────────────────────────────────────┤
│  Data Cell 1         │  Data Cell 2         │  Data 3    │  ← On Hover
│  Background: #D6F4ED │                                    │     (Light)
├──────────────────────────────────────────────────────────┤
│  Data Cell 1         │  Data Cell 2         │  Data 3    │  ← Row
└──────────────────────────────────────────────────────────┘
```

### Badge Component
```
STATUS BADGES

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PENDING      │  │ COMPLETED    │  │ APPROVED     │  │ REJECTED     │
│ Orange Tint  │  │ Green Tint   │  │ Blue Tint    │  │ Red Tint     │
│ Semi-Trans   │  │ Semi-Trans   │  │ Semi-Trans   │  │ Semi-Trans   │
│ Padding: 4x6 │  │ Padding: 4x6 │  │ Padding: 4x6 │  │ Padding: 4x6 │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Form Component
```
Form Label (12px, Bold, Uppercase)
↓
┌─────────────────────────────────────┐
│  Text Input / Select / Textarea     │
│  Border: 2px Teal                   │
│  Border Radius: 8px                 │
│  Padding: 10px 14px                 │
│  Focus State:                        │
│  → Border stays Teal                │
│  → Adds soft shadow                 │
└─────────────────────────────────────┘
↓
[Next Form Group or Submit Button]
```

---

## 📊 Typography Scale

```
H1 (Page Title)
32px, Weight: 700, Color: #2c3e50
↑ Largest

H2 (Section Title)
18px, Weight: 700, Color: #2c3e50

H3 (Card Title)
16px, Weight: 700, Color: #2c3e50

Body Text
14px, Weight: 400, Color: #2c3e50

Label
12px, Weight: 600, Color: #87BAC3, Uppercase

Small Text
12px, Weight: 400, Color: #87BAC3
↑ Smallest
```

---

## 📍 Spacing Scale

```
4px   ▮             xs (small gaps)
8px   ▮▮            sm (button gaps)
12px  ▮▮▮           md (form spacing)
16px  ▮▮▮▮          lg (card padding)
20px  ▮▮▮▮▮         xl (section spacing)
24px  ▮▮▮▮▮▮        2xl (large sections)
30px  ▮▮▮▮▮▮▮       3xl (layout padding)
40px  ▮▮▮▮▮▮▮▮      4xl (section margins)
```

---

## 🎭 Shadow Effects

```
DEFAULT SHADOW (var(--shadow))
Box Shadow: 0 8px 22px rgba(2, 6, 23, 0.04)
Used for: Cards, modals, buttons on hover

LARGE SHADOW (var(--shadow-lg))
Box Shadow: 0 20px 48px rgba(2, 6, 23, 0.08)
Used for: Hovered cards, active modals
```

---

## 🔄 Hover States

```
CARD
┌──────────────────┐          ┌──────────────────┐
│  Normal State    │   HOVER  │  Lift Up Effect  │
│                  │  ─────→  │  Larger Shadow   │
│  Shadow: md      │          │  Shadow: lg      │
│  Y-axis: 0       │          │  Y-axis: -4px    │
└──────────────────┘          └──────────────────┘

BUTTON
┌──────────────────┐          ┌──────────────────┐
│  Normal State    │   HOVER  │  Darker Shade    │
│                  │  ─────→  │  Larger Shadow   │
│  Color: #87BAC3  │          │  Shadow: lg      │
│                  │          │  Y-axis: -2px    │
└──────────────────┘          └──────────────────┘

TABLE ROW
┌──────────────────┐          ┌──────────────────┐
│  Normal Row      │   HOVER  │  Light Bg        │
│                  │  ─────→  │  #D6F4ED         │
│  Bg: white       │          │  Subtle change   │
└──────────────────┘          └──────────────────┘
```

---

## 🌐 Responsive Breakpoints

```
Mobile              Tablet              Desktop              Large
≤ 480px            481-768px           769-1024px          1025px+

┌──────────┐       ┌──────────┐        ┌──────────┐        ┌──────────┐
│          │       │          │        │          │        │          │
│  Single  │  →   │  2 cols  │  →    │  2 cols  │  →    │  3 cols  │
│  Column  │      │  (stacked)│        │ (side)   │        │ (spread) │
│          │      │          │        │          │        │          │
└──────────┘      └──────────┘        └──────────┘        └──────────┘
```

---

## ✅ Standardization Checklist

| Component | Standardized | Across All Sections |
|-----------|-------------|-------------------|
| Colors | ✅ | ✅ AuditClient, Auditor, LeadAuditor, Management |
| Layout | ✅ | ✅ Centered, 1400px max-width |
| Cards | ✅ | ✅ White, rounded, shadows |
| Buttons | ✅ | ✅ Gradient backgrounds |
| Tables | ✅ | ✅ Light headers, consistent spacing |
| Forms | ✅ | ✅ 2px borders, standard padding |
| Badges | ✅ | ✅ Semi-transparent, matching colors |
| Typography | ✅ | ✅ Consistent font sizes & weights |
| Spacing | ✅ | ✅ Standardized scale |
| Shadows | ✅ | ✅ md & lg levels |
| Hover States | ✅ | ✅ Lift & color effects |
| Responsive | ✅ | ✅ Mobile-first approach |

---

## 📱 Visual Example

### AuditClient Dashboard (Before → After)
```
BEFORE                          AFTER
─────────────────────────────────────────
Header: Different colors    →   Header: #87BAC3
Cards: Various colors       →   Cards: Teal border
Tables: Different styling   →   Tables: Unified
Buttons: Different colors   →   Buttons: Gradient
Spacing: Inconsistent       →   Spacing: Unified
Typography: Mixed sizes     →   Typography: 32/18/14

Result: Fragmented look     →   Result: Professional, cohesive
```

---

**All sections now share the same PROFESSIONAL, UNIFIED design! 🎉**
