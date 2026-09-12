'use client';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { money, type ManualScopeItem } from './data';

export default function ManualScopeItems({
  items,
  onChange,
}: {
  items: ManualScopeItem[];
  onChange: (items: ManualScopeItem[]) => void;
}) {
  const change = (id: string, patch: Partial<ManualScopeItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div>
      <div className="build-manual-toolbar">
        <Button
          variant="outline"
          onClick={() =>
            onChange([
              ...items,
              {
                id: crypto.randomUUID(),
                name: 'New work package',
                description:
                  'Describe what is included, the deliverable, and any exclusions.',
                quantity: 1,
                unit: 'package',
                rate: 0,
                included: true,
              },
            ])
          }
        >
          <Plus size={16} /> Add work package
        </Button>
        <span className="build-help">
          For design, materials, labor, or any defined scope.
        </span>
      </div>
      {items.map((item, index) => (
        <article
          className={`scope-item build-manual-item ${item.included ? '' : 'excluded'}`}
          key={item.id}
        >
          <div className="scope-item-top build-manual-heading">
            <Checkbox
              aria-label={`Include ${item.name}`}
              checked={item.included}
              onCheckedChange={(v) => change(item.id, { included: !!v })}
            />
            <span className="item-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <Input
              className="build-manual-title"
              aria-label="Work package name"
              value={item.name}
              onChange={(e) => change(item.id, { name: e.target.value })}
              maxLength={200}
            />
            <Button
              variant="ghost"
              aria-label={`Remove ${item.name}`}
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <Textarea
            className="scope-description"
            aria-label={`${item.name} description`}
            value={item.description}
            onChange={(e) => change(item.id, { description: e.target.value })}
          />
          <div className="build-manual-inputs">
            <label htmlFor={`${item.id}-field-1`}>
              Quantity
              <Input
                id={`${item.id}-field-1`}
                type="number"
                min="0"
                max="1000000"
                step=".01"
                value={item.quantity}
                onChange={(e) =>
                  change(item.id, {
                    quantity: Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </label>
            <label htmlFor={`${item.id}-field-2`}>
              Unit
              <Input
                id={`${item.id}-field-2`}
                value={item.unit}
                onChange={(e) => change(item.id, { unit: e.target.value })}
                maxLength={30}
              />
            </label>
            <label htmlFor={`${item.id}-field-3`}>
              Unit rate (USD)
              <Input
                id={`${item.id}-field-3`}
                type="number"
                min="0"
                max="1000000"
                step=".01"
                value={item.rate}
                onChange={(e) =>
                  change(item.id, { rate: Math.max(0, Number(e.target.value)) })
                }
              />
            </label>
          </div>
          <div className="scope-pricing">
            <span className="build-help">
              {item.rate === 0
                ? 'Set the rate; zero is treated as a no-charge item.'
                : 'Quantity × unit rate'}
            </span>
            <strong>{money(item.quantity * item.rate)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
