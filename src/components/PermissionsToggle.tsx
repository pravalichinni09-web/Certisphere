import React from 'react';
import { ALL_PERMISSIONS, PermissionKey } from '../utils/permissions';

interface Props {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
}

const PermissionsToggle: React.FC<Props> = ({ value, onChange }) => {
  const groups = ALL_PERMISSIONS.reduce<Record<string, typeof ALL_PERMISSIONS>>((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push(p);
    return acc;
  }, {});

  const toggle = (key: PermissionKey) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };

  return (
    <div className="perm-toggle">
      {Object.entries(groups).map(([group, items]) => (
        <fieldset key={group} className="perm-group">
          <legend>{group}</legend>
          {items.map((p) => {
            const on = value.includes(p.key);
            return (
              <label key={p.key} className={`perm-row ${on ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.key)}
                />
                <span className="perm-row__main">
                  <span className="perm-row__label">{p.label}</span>
                  <span className="perm-row__desc">{p.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};

export default PermissionsToggle;
