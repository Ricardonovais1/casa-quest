// ============================================================
// Casa Quest — Mor Dashboard (Overview)
// ============================================================

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bem-vindo ao painel do Guardião-Mor
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Missão Atual"
          value="Dia 8 de 15"
          icon="🎯"
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Ações Hoje"
          value="12 pendentes"
          icon="✅"
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Confirmações"
          value="3 aguardando"
          icon="👀"
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Energia Média"
          value="87%"
          icon="⚡"
          color="bg-indigo-50 text-indigo-700"
        />
      </div>

      {/* Getting started */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          🚀 Começando
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Siga estes passos para configurar sua família no Casa Quest.
        </p>
        <div className="mt-4 space-y-3">
          <Step
            number={1}
            title="Configure sua família"
            description="Defina nome, regras e tolerâncias"
            done={false}
          />
          <Step
            number={2}
            title="Adicione os Guardiões"
            description="Cadastre cada criança ou adolescente"
            done={false}
          />
          <Step
            number={3}
            title="Crie os templates de ações"
            description="Defina as responsabilidades diárias"
            done={false}
          />
          <Step
            number={4}
            title="Inicie uma Missão"
            description="Defina o período e o valor-alvo da mesada"
            done={false}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className={`rounded-lg px-2 py-1 text-lg ${color}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  done,
}: {
  number: number;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? 'bg-emerald-500 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? '✓' : number}
      </span>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}
