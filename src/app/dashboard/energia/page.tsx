// ============================================================
// Casa Quest — Dashboard: Energy Overview
// ============================================================

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function EnergyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Energia</h1>
        <p className="mt-1 text-sm text-gray-500">
          Acompanhe o compromisso de cada Guardião
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>⚡ Estado atual</CardTitle>
          <CardDescription>
            A energia é calculada a partir de faltas, sequências, recuperações e escaladas
          </CardDescription>
        </CardHeader>
        <p className="text-sm text-gray-400">
          Inicie uma missão para começar a acompanhar a energia.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📊 Como é calculado?</CardTitle>
          <CardDescription>
            Transparência total: veja cada evento que compõe a energia
          </CardDescription>
        </CardHeader>
        <div className="space-y-2 text-xs text-gray-500">
          <p>• <strong>Faltas isoladas:</strong> -1 cada</p>
          <p>• <strong>Sequências consecutivas:</strong> penalidade exponencial (2ⁿ - 1)</p>
          <p>• <strong>Reincidência:</strong> penalidade por múltiplas sequências (2ᵏ - 1)</p>
          <p>• <strong>Recuperação:</strong> +2 por ação de compensação</p>
          <p>• <strong>Escalada:</strong> pontos extras por ir além</p>
          <p>• <strong>Cooperação:</strong> bônus na recompensa final</p>
        </div>
      </Card>
    </div>
  );
}
