# Design System - Standardized Color Palette & Components

## Color Variables (Global)

### Primary Colors
```css
--primary-blue: #87BAC3          /* Main brand color */
--primary-teal: #87BAC3          /* Secondary brand color (same as primary) */
--primary-orange: #87BAC3        /* Accent color (normalized to primary) */
--primary-purple: #87BAC3        /* Accent color (normalized to primary) */
```

### Neutral Colors
```css
--light-bg: #D6F4ED              /* Light background, cards background */
--card-bg: #ffffff               /* Card background */
--text-dark: #2c3e50             /* Primary text color */
--text-light: #87BAC3            /* Secondary text, labels */
--border-color: #87BAC3          /* Borders, dividers */
```

### Shadow Effects
```css
--shadow: 0 8px 22px rgba(2, 6, 23, 0.04)        /* Default shadow */
--shadow-lg: 0 20px 48px rgba(2, 6, 23, 0.08)    /* Large shadow */
```

---

## Component Library

### Buttons

#### Primary Button (Submit)
```css
.submit-btn {
  background: linear-gradient(135deg, #87BAC3 0%, #87BAC3 100%);
  color: #fff;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
```

#### Secondary Button (Cancel)
```css
.cancel-btn {
  background: #D6F4ED;
  color: #2c3e50;
  border: 1px solid #87BAC3;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
```

### Cards

#### Standard Card
```css
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.04);
  border-left: 5px solid #87BAC3;
}
```

#### Stat Card
```css
.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 16px;
  align-items: center;
  box-shadow: var(--shadow);
  border-left: 5px solid #87BAC3;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

### Tables

#### Table Header
```css
.table-header {
  background: #D6F4ED;
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #87BAC3;
  text-transform: uppercase;
  border-bottom: 2px solid #87BAC3;
}
```

#### Table Row
```css
.table-row {
  padding: 14px 16px;
  border-bottom: 1px solid #87BAC3;
  color: #2c3e50;
  font-size: 14px;
}

.table-row:hover {
  background: #D6F4ED;
}
```

### Badges

#### Status Badges
```css
/* Pending */
.status-pending {
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

/* Completed */
.status-completed {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

/* Approved */
.status-approved {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

/* Rejected */
.status-rejected {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
```

#### Role Badges
```css
.role-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.role-badge.internal {
  background: rgba(59, 130, 246, 0.1);
  color: #87BAC3;
}

.role-badge.external {
  background: rgba(168, 85, 247, 0.1);
  color: #87BAC3;
}
```

### Forms

#### Form Group
```css
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #87BAC3;
  border-radius: 8px;
  font-size: 14px;
  color: #2c3e50;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #87BAC3;
  box-shadow: 0 0 0 3px rgba(135, 186, 195, 0.1);
}
```

### Modals

#### Modal Container
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 20px 48px rgba(2, 6, 23, 0.08);
  animation: slideDown 0.3s ease-out;
}
```

### Layouts

#### Dashboard Layout
```css
.dashboard-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background: #D6F4ED;
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 70px;
  width: 100%;
  padding: 30px;
  background: linear-gradient(135deg, #D6F4ED 0%, #e0e7ff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dashboard-content > div {
  width: 100%;
  max-width: 1400px;
}
```

### Typography

#### Heading Styles
```css
h1 {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 8px 0;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 16px 0;
}

h3 {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 12px 0;
}
```

#### Text Styles
```css
.text-dark {
  color: #2c3e50;
}

.text-light {
  color: #87BAC3;
}

.text-small {
  font-size: 12px;
}

.text-muted {
  color: #87BAC3;
  opacity: 0.8;
}
```

---

## Spacing Scale

| Size | Value | Usage |
|------|-------|-------|
| xs | 4px | Small gaps |
| sm | 8px | Button gaps |
| md | 12px | Form spacing |
| lg | 16px | Card padding, gaps |
| xl | 20px | Section spacing |
| 2xl | 24px | Large sections |
| 3xl | 30px | Layout padding |
| 4xl | 40px | Section margins |

---

## Shadow Scale

| Level | Value |
|-------|-------|
| sm | `0 4px 6px rgba(0, 0, 0, 0.07)` |
| md | `0 8px 22px rgba(2, 6, 23, 0.04)` |
| lg | `0 20px 48px rgba(2, 6, 23, 0.08)` |

---

## Breakpoints

```css
/* Mobile */
@media (max-width: 480px) { }

/* Tablet */
@media (max-width: 768px) { }

/* Small Desktop */
@media (max-width: 1024px) { }

/* Large Desktop */
@media (min-width: 1440px) { }
```

---

## Usage Examples

### Creating a New Page with Standard Styling

```html
<div class="dashboard-layout">
  <div class="dashboard-content">
    <div>
      <div class="dashboard-header">
        <h1>Page Title</h1>
        <p>Subtitle or description</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <p class="stat-label">Label</p>
            <p class="stat-value">123</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Section Title</h2>
        <table class="dashboard-table">
          <thead>
            <tr>
              <th>Column 1</th>
              <th>Column 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
```

---

## Color Reference by Section

All sections now use:
- Primary: #87BAC3
- Background: #D6F4ED
- Text: #2c3e50
- Accent: #87BAC3

**This ensures perfect visual consistency across the entire CMS!**
