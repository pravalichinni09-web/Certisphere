import { useEffect, useState } from 'react';
import { getCurrentClient, getBranchesForClient } from '../../services/clientCoordinatorService';

export default function OrganizationDetails() {
  const [client, setClient] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const c = getCurrentClient();
    setClient(c);
    setBranches(getBranchesForClient(c?.id));
  }, []);

  if (!client) return <div className="card">No organization data available.</div>;

  return (
    <div>
      <h2>Organization Details</h2>
      <div className="card">
        <p><strong>Name:</strong> {client.organizationName}</p>
        <p><strong>Address:</strong> {client.address}</p>
        <p><strong>Contact:</strong> {client.contactPerson} · {client.email}</p>
      </div>

      <h3 style={{ marginTop: 12 }}>Branches / Units</h3>
      {branches.length === 0 ? (
        <div className="card">No branches defined.</div>
      ) : (
        branches.map((b) => (
          <div key={b.id} className="card" style={{ marginBottom: 8 }}>
            <strong>{b.name}</strong>
            <div>{b.address}</div>
          </div>
        ))
      )}
    </div>
  );
}
