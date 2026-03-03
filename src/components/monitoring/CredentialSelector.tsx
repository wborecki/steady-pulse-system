import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCredentialsByCheckType, credentialTypeLabels, type Credential } from '@/hooks/useCredentials';
import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CredentialSelectorProps {
  checkType: string;
  onSelect: (credential: Credential | null) => void;
}

export function CredentialSelector({ checkType, onSelect }: CredentialSelectorProps) {
  const { data: credentials, isLoading } = useCredentialsByCheckType(checkType);

  if (!credentials?.length && !isLoading) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/20 p-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Nenhuma credencial salva compatível.{' '}
          <Link to="/connections" className="text-primary hover:underline">Criar credencial</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-primary" />
        <Label className="text-xs font-medium">Usar credencial salva</Label>
      </div>
      <Select
        onValueChange={(value) => {
          if (value === '__none__') {
            onSelect(null);
          } else {
            const cred = credentials?.find(c => c.id === value);
            onSelect(cred ?? null);
          }
        }}
      >
        <SelectTrigger className="bg-secondary border-border">
          <SelectValue placeholder="Selecionar credencial (opcional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Preencher manualmente</SelectItem>
          {credentials?.map(cred => (
            <SelectItem key={cred.id} value={cred.id}>
              <span className="flex items-center gap-2">
                <span>{cred.name}</span>
                <span className="text-muted-foreground text-xs">({credentialTypeLabels[cred.credential_type]})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
