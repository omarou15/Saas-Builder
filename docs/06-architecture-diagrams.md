# Architecture FYREN Platform — Diagrammes Mermaid

**Projet** : FYREN Platform
**Date** : 22 mars 2026
**Usage** : Read-only, compréhension de l'architecture existante
**Rendu** : Coller dans un viewer Mermaid (GitHub, VS Code extension, mermaid.live)

---

## 1. Composants — Architecture des modules

> Vue d'ensemble : pages, composants, API routes, server modules, lib et leurs dépendances.

```mermaid
flowchart TB
    subgraph "Pages - App Router"
        LP["/ Landing"]
        SI["(auth)/sign-in"]
        SU["(auth)/sign-up"]
        DASH["(dashboard)/app"]
        NEW["(dashboard)/app/new"]
        BILL["(dashboard)/app/billing"]
        SET["(dashboard)/app/settings"]
        WS["(dashboard)/app/project/[id]"]
    end

    subgraph "Components"
        direction TB
        LAND["landing/landing-page"]
        ANIM["landing/animated-counter\ncode-rain\npreview-mockup\ntyping-code"]
        DC["dashboard/dashboard-content"]
        WL["workspace/workspace-layout"]
        CP["workspace/chat-panel"]
        WH["workspace/workspace-header"]
        DD["workspace/deploy-dialog"]
        PP["preview/preview-panel"]
        FT["preview/file-tree"]
        WCM["preview/webcontainer-manager"]
        UI["ui/ shadcn\nbutton, card, dialog,\ninput, tabs, skeleton..."]
    end

    subgraph "API Routes"
        CHAT["/api/chat"]
        PROJ["/api/projects"]
        CONN["/api/connect/*"]
        BUILD["/api/build/*"]
        DEPLOY["/api/deploy"]
        BILLING["/api/billing/*"]
        WH_CLERK["/api/webhooks/clerk"]
        WH_STRIPE["/api/webhooks/stripe"]
    end

    subgraph "Server"
        AR["agent/agent-runner"]
        SS["agent/session-store"]
        SM["agent/sandbox-manager"]
        AT["agent/tools"]
        PR["agent/prompts"]
        BP["build-pipeline"]
        DP["deploy/index"]
        DG["deploy/github"]
        DV["deploy/vercel"]
        DS["deploy/supabase"]
    end

    subgraph "Lib"
        SUPA["supabase"]
        CRYP["crypto"]
        CRED["credits"]
        RL["rate-limit"]
        UT["utils"]
    end

    subgraph "Types"
        TY["types/index"]
        TDB["types/database"]
    end

    LP --> LAND --> ANIM
    DASH --> DC
    WS --> WL
    WL --> CP & PP & FT & DD & WH
    PP --> WCM
    CP --> UI
    PP --> UI

    BUILD --> AR & SS & SM
    AR --> AT & SS & PR
    AT --> SM
    BUILD --> BP
    DEPLOY --> DP --> DG & DV & DS

    CHAT --> SUPA & CRED & RL
    PROJ --> SUPA & CRED & RL
    CONN --> CRYP & SUPA & RL
    BUILD --> CRED & RL
    BILLING --> SUPA & CRED & RL

    AR --> CRED & SUPA & UT
    DP --> SUPA & UT
    DG --> CRYP
    DV --> CRYP
    DS --> CRYP
```

---

## 2. Base de données — Schema ER

> Tables Supabase (Postgres), relations et RLS. Les API keys dans `service_connections.config` sont chiffrées AES-256-GCM.

```mermaid
erDiagram
    users {
        UUID id PK
        TEXT clerk_id UK
        TEXT email
        TEXT name
        DECIMAL credits
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    projects {
        UUID id PK
        UUID user_id FK
        TEXT name
        TEXT slug UK
        TEXT status "draft|intake|building|deployed|archived"
        JSONB cdc_json
        JSONB stack_config
        TEXT sandbox_id
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    service_connections {
        UUID id PK
        UUID project_id FK
        TEXT service "github|vercel|supabase|clerk|stripe|resend"
        JSONB config "AES-256-GCM encrypted"
        TEXT status "pending|connected|error"
        TIMESTAMPTZ created_at
    }

    conversations {
        UUID id PK
        UUID project_id FK
        TEXT type "intake|build|iterate"
        TIMESTAMPTZ created_at
    }

    messages {
        UUID id PK
        UUID conversation_id FK
        TEXT role "user|assistant|system"
        TEXT content
        INTEGER tokens_used
        DECIMAL cost_usd
        TIMESTAMPTZ created_at
    }

    credit_transactions {
        UUID id PK
        UUID user_id FK
        TEXT type "purchase|usage|refund|welcome"
        DECIMAL amount
        TEXT description
        TEXT stripe_id
        UUID project_id FK
        TIMESTAMPTZ created_at
    }

    users ||--o{ projects : "owns"
    users ||--o{ credit_transactions : "has"
    projects ||--o{ service_connections : "has"
    projects ||--o{ conversations : "has"
    projects ||--o{ credit_transactions : "billed to"
    conversations ||--o{ messages : "contains"
```

---

## 3. Data Flow — Parcours d'un build complet

> Sequence diagram : de l'intake conversationnel au deploy sur l'infra du client.

```mermaid
sequenceDiagram
    actor U as Client
    participant FE as Frontend<br/>(Next.js)
    participant API as API Routes
    participant AUTH as Clerk
    participant CRED as Credits
    participant SS as Session Store
    participant AR as Agent Runner
    participant E2B as E2B Sandbox
    participant LLM as OpenRouter
    participant WC as WebContainer
    participant GH as GitHub
    participant VCL as Vercel
    participant SDB as Supabase<br/>(Client DB)

    Note over U,SDB: Phase 1 - Intake (CDC)
    U->>FE: Decrit son app
    FE->>API: POST /api/chat
    API->>AUTH: Verify JWT
    API->>CRED: Check balance
    API->>LLM: Stream (Sonnet)
    LLM-->>API: CDC structure (JSON)
    API-->>FE: SSE stream
    FE-->>U: Affiche CDC

    Note over U,SDB: Phase 2 - Connect Services
    U->>FE: Fournit API keys
    FE->>API: POST /api/connect/service
    API->>API: encrypt(AES-256-GCM)
    API->>SDB: INSERT service_connections
    API-->>FE: Status: connected

    Note over U,SDB: Phase 3 - Build
    U->>FE: Lance le build
    FE->>API: POST /api/build/start
    API->>E2B: createSandbox()
    E2B-->>API: sandbox + scaffolded /workspace/
    API->>SS: createSession()
    API-->>FE: sessionId

    FE->>API: GET /api/build/[id]/stream (SSE)

    loop Pour chaque etape (scaffold -> frontend)
        FE->>API: POST /api/build/[id]/message
        API->>AR: runAgentStep()
        AR->>LLM: generateText() + tools
        LLM-->>AR: tool calls (Write, Edit, Bash...)
        AR->>E2B: Execute tools
        E2B-->>AR: Results
        AR->>SS: emit(file_change)
        SS-->>FE: SSE event
        FE->>WC: writeFile() + HMR
        WC-->>U: Preview live updated
        AR->>CRED: deductCredits()
    end

    Note over U,SDB: Phase 4 - Deploy
    U->>FE: Deploy
    FE->>API: POST /api/deploy
    API->>GH: pushToGitHub() (Octokit)
    GH-->>API: repoUrl, commitSha
    API->>VCL: setupVercelProject()
    VCL-->>API: deployUrl
    API->>SDB: applySupabaseSchema(SQL)
    SDB-->>API: OK
    API-->>FE: URLs (GitHub + Vercel + Supabase)
    FE-->>U: App deployee
```

---

## Patterns architecturaux cles

| Pattern | Implementation |
|---|---|
| **Event-Driven Streaming** | Agent emits events via EventEmitter -> Frontend subscribe via SSE |
| **Sandbox isole** | Chaque build = 1 Firecracker microVM E2B avec Next.js scaffold |
| **Secrets chiffres** | API keys AES-256-GCM avant stockage, decrypt in-memory au deploy |
| **RLS-First** | Toutes les tables Supabase avec Row Level Security + Clerk JWT |
| **Credit metering** | OpenRouter cost x3 = FYREN credits, deduction atomique via RPC Postgres |
| **Multi-stage pipeline** | 8 etapes avec modele LLM, tools et skills specifiques par etape |
| **Zero lock-in** | Code genere sans dependance FYREN, push sur GitHub client |
| **Rate limiting** | In-memory per-user/per-action (TODO: Redis pour multi-instance) |
