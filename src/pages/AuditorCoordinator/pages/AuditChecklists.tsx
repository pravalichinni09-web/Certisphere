import React, { useState } from 'react';
import { Plus, Download, Eye, Trash2 } from 'lucide-react';
import '../../../styles/AuditorCoordinator.css';

interface Checklist {
  id: number;
  name: string;
  auditType: string;
  items: number;
  standard: string;
  createdDate: string;
  status: 'Active' | 'Draft';
}

const AuditChecklists: React.FC = () => {
  const [checklists] = useState<Checklist[]>([
    {
      id: 1,
      name: 'ISO 9001 Quality Checklist',
      auditType: 'Quality Management',
      items: 6,
      standard: 'ISO 9001:2015',
      createdDate: '2025-11-10',
      status: 'Active'
    },
    {
      id: 2,
      name: 'Environmental Compliance',
      auditType: 'Environmental',
      items: 5,
      standard: 'ISO 14001:2015',
      createdDate: '2025-10-20',
      status: 'Active'
    },
    {
      id: 3,
      name: 'Health & Safety Assessment',
      auditType: 'Occupational Health',
      items: 3,
      standard: 'ISO 45001:2018',
      createdDate: '2025-12-01',
      status: 'Draft'
    },
  ]);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="checklists-container">
      <div className="checklists-header">
        <div>
          <h1>Audit Checklists</h1>
          <p>Create and manage audit checklists for different standards</p>
        </div>
        <button className="add-btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} /> New Checklist
        </button>
      </div>

      {showForm && (
        <div className="checklist-form">
          <h3>Create New Checklist</h3>
          <form>
            <div className="form-group">
              <label>Checklist Name</label>
              <input type="text" placeholder="Enter checklist name" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Audit Type</label>
                <select>
                  <option>Quality Management</option>
                  <option>Environmental</option>
                  <option>Occupational Health</option>
                </select>
              </div>
              <div className="form-group">
                <label>Standard</label>
                <select>
                  <option>ISO 9001:2015</option>
                  <option>ISO 14001:2015</option>
                  <option>ISO 45001:2018</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Checklist Items (one per line)</label>
              <textarea placeholder="Enter checklist items..."></textarea>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn">Add</button>
              <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="checklists-grid">
        {checklists.map((checklist) => (
          <div key={checklist.id} className="checklist-card">
            <div className="card-header">
              <h3>{checklist.name}</h3>
              <span className={`status-badge status-${checklist.status.toLowerCase()}`}>
                {checklist.status}
              </span>
            </div>

            <div className="card-details">
              <p><strong>Type:</strong> {checklist.auditType}</p>
              <p><strong>Standard:</strong> {checklist.standard}</p>
              <p><strong>Items:</strong> {checklist.items}</p>
              <p><strong>Created:</strong> {checklist.createdDate}</p>
            </div>

            <div className="card-actions">
              <button className="action-btn view">
                <Eye size={18} /> View
              </button>
              <button className="action-btn download">
                <Download size={18} /> Export
              </button>
              <button className="action-btn delete">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditChecklists;
