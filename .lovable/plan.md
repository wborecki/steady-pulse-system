

## Problem

Currently the form allows any combination of category + check_type (e.g. "API" + "SQL Server"), which makes no sense. There are also no fields for SSH credentials, HTTP auth headers, or database-specific credentials beyond connection strings.

## Solution

Refactor the service registration into a **category-driven form** where selecting a category auto-determines the available check types and shows only the relevant credential fields.

### Category-to-Check-Type Mapping

```text
Category          Allowed Check Types        Auth Fields
─────────────────────────────────────────────────────────────
AWS               cloudwatch, s3             (uses backend secrets)
Banco de Dados    sql_query, postgresql,     Connection string OR
                  mongodb                    host/port/user/password/database
Airflow           http                       URL + optional token/basic auth
Servidores        tcp, process               Host/Port + SSH (user, password
                                             or key, port 22)
Processos         process                    Host + SSH credentials +
                                             process name/PID
APIs              http                       URL + method + headers +
                                             basic auth or bearer token
```

### Implementation Steps

**1. Extract form to dedicated component `src/components/monitoring/AddServiceForm.tsx`**
- Move the entire `<form>` out of `Services.tsx` into a clean component
- Keeps `Services.tsx` focused on the list/filter logic

**2. Define category-check mapping as a constant**
```
categoryCheckTypes = {
  aws: ['cloudwatch', 's3'],
  database: ['sql_query', 'postgresql', 'mongodb'],
  airflow: ['http'],
  server: ['tcp', 'process'],
  process: ['process'],
  api: ['http'],
}
```
- When user picks a category, auto-select the first check type and filter the dropdown
- If category only has one check type, hide the dropdown entirely

**3. Add conditional authentication sections per check type**

- **HTTP (`api`, `airflow`)**: URL, HTTP method (GET/POST/HEAD), optional auth type (None / Basic / Bearer), username/password or token, custom headers (key-value pairs), expected status code
- **TCP + SSH (`server`)**: Host, Port, optional SSH toggle with username, auth method (password or private key), SSH port
- **Process (`process`, `server`)**: Same SSH fields + process name or command to check
- **Database (`sql_query`)**: Info box (uses backend Azure credentials)
- **PostgreSQL**: Choice between connection string OR individual fields (host, port, database, username, password, SSL mode)
- **MongoDB**: Choice between connection string OR individual fields (host, port, database, username, password, auth source)
- **CloudWatch**: Resource type (EC2/RDS), Instance ID, Region (defaults from backend)
- **S3**: Bucket name, Region, optional prefix path

**4. Update `handleAddService` to map all new fields into `check_config`**
- SSH credentials go into `check_config.ssh: { host, port, username, password?, private_key? }`
- HTTP auth goes into `check_config.auth: { type, username?, password?, token?, headers? }`
- Database individual fields go into `check_config` as `host`, `port`, `username`, `password`, `database`, `ssl_mode`

**5. Make dialog scrollable**
- Add `max-h-[80vh] overflow-y-auto` to DialogContent since the form will be taller with more fields

### Files Changed

| File | Change |
|------|--------|
| `src/components/monitoring/AddServiceForm.tsx` | New component with category-driven form logic |
| `src/pages/Services.tsx` | Remove inline form, import `AddServiceForm` |

No database migration needed -- all new fields are stored in the existing `check_config` JSONB column.

