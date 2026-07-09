# Certification Management System

A modern web application built with Vite + React + TypeScript for managing certification audits with a beautiful, intuitive login interface.

## Features

✨ **Modern UI Design** - Inspired by contemporary design patterns with gradient color schemes
- Primary Colors: Blue, Teal, Orange, Purple
- Smooth animations and transitions
- Responsive design for all screen sizes

👥 **User Roles** - Four predefined user types:
- Audit Coordinator
- Audit Client
- Lead Auditor
- Auditor

🔐 **Interactive Login System**
- Email and password authentication
- Quick user selection from credentials panel
- Auto-populated credentials when selecting a user role
- Mock credentials for testing

📱 **Responsive Layout**
- Split-screen design (Login form + Credentials panel)
- Mobile and tablet optimized
- Flexible component architecture

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
npm install
```

> Preferred terminal: Command Prompt (Windows)

This workspace is configured to use Command Prompt as the default integrated terminal in VS Code.
If your editor is still opening PowerShell, reload the window or open a new terminal.

### Development

```bash
npm run dev
```

The app will open automatically at `http://localhost:3000`

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Test Credentials

Use any of the following credentials to test the login system:

| Role | Email | Password |
|------|-------|----------|
| Audit Coordinator | coordinator@cms.com | AuditCoord@123 |
| Audit Client | client@cms.com | AuditClient@123 |
| Lead Auditor | lead@cms.com | LeadAudit@123 |
| Auditor | auditor@cms.com | Auditor@123 |

**How to Use:**
1. Click on any user role card on the right panel
2. The credentials will automatically populate in the login form
3. Click "Sign In" to proceed

## Project Structure

```
src/
├── components/
│   ├── LoginForm.tsx
│   └── UserCredentials.tsx
├── pages/
│   └── LoginPage.tsx
├── styles/
│   ├── LoginForm.css
│   ├── LoginPage.css
│   └── UserCredentials.css
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## Color Palette

- **Primary Blue**: #2563eb
- **Primary Teal**: #14b8a6
- **Primary Orange**: #f59e0b
- **Primary Purple**: #a855f7
- **Light Background**: #f8fafc
- **Card Background**: #ffffff
- **Text Dark**: #1e293b
- **Text Light**: #64748b

## Technologies Used

- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Lucide React** - Beautiful icon library
- **CSS3** - Modern styling with gradients and animations

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Author

Created as a Certification Management System UI for testing and demo purposes.
