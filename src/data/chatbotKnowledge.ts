export interface ChatbotNode {
  id: string;
  title: string;
  message: string;
  options: {
    label: string;
    nextNodeId?: string;
    action?: 'node' | 'escalate' | 'resolve';
  }[];
}

export const CHATBOT_NODES: Record<string, ChatbotNode> = {
  root: {
    id: 'root',
    title: 'Central de Autoatendimento BarberBot',
    message: 'Olá! Eu sou o BarberBot, o assistente virtual do seu sistema. Como posso te ajudar hoje? Selecione um dos tópicos abaixo ou fale diretamente com a nossa equipe:',
    options: [
      { label: '🔓 Reativação de Licença / Painel Congelado', nextNodeId: 'reactivation', action: 'node' },
      { label: '💳 Assinatura, Cobrança e Renovação', nextNodeId: 'billing', action: 'node' },
      { label: '🚀 Upgrade de Plano ou Limite de Barbeiros', nextNodeId: 'upgrade', action: 'node' },
      { label: '💈 Como Cadastrar e Configurar Barbeiros', nextNodeId: 'barbers', action: 'node' },
      { label: '⏰ Horários de Funcionamento e Pausas', nextNodeId: 'schedule', action: 'node' },
      { label: '📊 Relatórios, Faturamento e Comissões', nextNodeId: 'financial', action: 'node' },
      { label: '💬 Falar diretamente com o Administrador Master', action: 'escalate' },
    ],
  },

  reactivation: {
    id: 'reactivation',
    title: 'Reativação de Licença do Painel',
    message: 'Entendemos que o acesso ao seu painel está temporariamente suspenso ou congelado.\n\nA reativação é realizada de forma prioritária pelo Administrador Master assim que a verificação for concluída.\n\nClique no botão abaixo para encaminhar sua solicitação de reativação imediata para nosso suporte humano.',
    options: [
      { label: '⚡ Solicitar Reativação ao Administrador Agora', action: 'escalate' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },

  billing: {
    id: 'billing',
    title: 'Assinatura, Cobrança e Renovação',
    message: 'Sobre a sua assinatura do SaaS:\n\n• Data de Vencimento: Você pode consultar na aba "Meu Plano SaaS" ou no topo do seu painel.\n• Renovação: Para renovar ou regularizar sua fatura via Pix ou Cartão, fale com nosso suporte financeiro.\n• Reativação: Caso seu painel esteja suspenso, a liberação ocorre em instantes após a confirmação do pagamento.',
    options: [
      { label: '✅ Entendi, obrigado!', action: 'resolve' },
      { label: '💬 Não resolveu, quero falar com o Administrador', action: 'escalate' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },

  upgrade: {
    id: 'upgrade',
    title: 'Upgrade de Plano ou Limites',
    message: 'Quer expandir sua barbearia e adicionar mais barbeiros ao sistema?\n\n• Plano Pro Barber: Permite até 5 barbeiros cadastrados com controle de comissão individual.\n• Plano Master Barber: Barbeiros ilimitados, prioridade no suporte e relatórios avançados.\n\nClique no botão abaixo para solicitar a alteração do seu plano ao Administrador Master.',
    options: [
      { label: '🚀 Solicitar Upgrade ao Administrador', action: 'escalate' },
      { label: '✅ Apenas tirando dúvidas', action: 'resolve' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },

  barbers: {
    id: 'barbers',
    title: 'Como Cadastrar e Configurar Barbeiros',
    message: 'Para gerenciar sua equipe no sistema:\n\n1. Acesse a aba "Equipe de Barbeiros" no menu do seu painel.\n2. Clique em "Cadastrar Novo Barbeiro".\n3. Preencha nome, WhatsApp, foto de perfil e a porcentagem de comissão (ex: 70%).\n4. Salve. O barbeiro ficará disponível para agendamento online na hora!',
    options: [
      { label: '✅ Conseguir cadastrar!', action: 'resolve' },
      { label: '💬 Tive um problema, preciso de suporte humano', action: 'escalate' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },

  schedule: {
    id: 'schedule',
    title: 'Horários de Funcionamento e Pausas',
    message: 'Como gerenciar sua grade de horários:\n\n• Os agendamentos seguem o horário de atendimento configurado.\n• Na aba "Agenda", você visualiza os compromissos do dia, pode remarcar horários ou alterar barbeiros.\n• Para bloqueios de emergência ou folgas, adicione uma pausa no sistema.',
    options: [
      { label: '✅ Esclarecido, obrigado!', action: 'resolve' },
      { label: '💬 Preciso de ajuda com um caso específico', action: 'escalate' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },

  financial: {
    id: 'financial',
    title: 'Relatórios, Faturamento e Comissões',
    message: 'Entenda os números da sua barbearia:\n\n• Faturamento Bruto: Soma de todos os serviços concluídos.\n• Comissões: Calculadas automaticamente de acordo com o percentual de cada barbeiro.\n• Lucro da Barbearia: Valor líquido restante para o estabelecimento.',
    options: [
      { label: '✅ Tudo certo com meus relatórios!', action: 'resolve' },
      { label: '💬 Falar com o Administrador sobre financeiro', action: 'escalate' },
      { label: '↩️ Voltar ao Menu Principal', nextNodeId: 'root', action: 'node' },
    ],
  },
};

