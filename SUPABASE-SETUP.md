# Supabase — configuração Modelo Profissional

1. Crie um projeto Supabase de desenvolvimento.
2. No SQL Editor do projeto, cole e execute `supabase/migrations/202611050001_professional_clinic.sql`.
3. Para mostrar horários livres, ocupados e bloqueados e habilitar pedidos recorrentes para todas as quartas (ou outro dia da semana) selecionadas, abra uma nova consulta no SQL Editor, cole e execute `supabase/migrations/202611050002_slot_statuses.sql`. A função recorrente valida todas as datas antes de criar qualquer agendamento; se uma estiver ocupada, rejeita a série inteira. A atualização cria funções e permissões e não apaga agendamentos.
4. Para permitir conversas diretas pelo WhatsApp de cada profissional, execute `supabase/migrations/202611050003_professional_whatsapp.sql` no SQL Editor. Depois, preencha o número de cada profissional na coluna `whatsapp_phone` da tabela `professionals` em Table Editor, com DDI e DDD (somente números, por exemplo `55` + DDD + telefone). Sem esse contato cadastrado, o cartão informa que o número ainda não está disponível.
5. Em Project Settings → API, copie Project URL e anon/public key. Adicione ao `.env.local` (sem `service_role`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON
```

6. Reinicie `npm run dev`.
7. Antes de publicar, defina `NEXT_PUBLIC_CLINIC_WHATSAPP` com o número real da clínica em formato internacional, somente números (ex.: `55` + DDD + telefone). O botão flutuante abre uma conversa com a equipe da clínica; o cartão do agendamento abre o contato direto do profissional selecionado.
8. Confira os profissionais, serviços e disponibilidade fictícios em Table Editor. A migração cria agenda de segunda a sexta, 9h–17h, no fuso de São Paulo.
9. Em Authentication → Users, crie um usuário para a clínica com e-mail e senha temporária. Copie o UUID desse usuário.
10. Cadastre o primeiro administrador no SQL Editor, substituindo o UUID e nome:

```sql
insert into public.staff_profiles(user_id, full_name, role)
values ('UUID-DO-USUARIO-AUTH', 'Admin Clínica Vita', 'admin');
```

11. Acesse `/admin/login`. Crie outros funcionários por Authentication e insira seus perfis em `staff_profiles` com papel `receptionist` ou `professional`. Para profissional, preencha `professional_id`.

## Configuração de produção

Configure as mesmas duas variáveis no provedor de hospedagem. Crie usuários de equipe com acesso mínimo necessário e remova os profissionais, preços, endereço e horários fictícios antes de publicar para uma clínica. Nunca use a chave `service_role` no cliente ou em `NEXT_PUBLIC_*`.

## Observações de segurança e escopo

- A disponibilidade e criação são RPCs do Postgres; a restrição de exclusão impede sobreposição mesmo se duas pessoas reservarem ao mesmo tempo.
- A página pública consulta somente o estado do horário (`available`, `booked` ou `blocked`); não exibe nomes, contatos ou IDs de pacientes para indicar horários ocupados.
- Pedidos para várias datas criam uma solicitação pendente em cada data para o mesmo paciente, profissional e horário; a série é toda aceita ou toda rejeitada.
- O visitante público recebe apenas o UUID de confirmação; RLS impede a leitura pública de pacientes e agendamentos.
- A confirmação é uma solicitação pendente. Mensagem por e-mail, lembrete e WhatsApp não estão ativados neste módulo; não mostramos que algo foi enviado.
- O cancelamento e a confirmação são feitos por equipe autenticada. O portal de paciente com login e remarcação pelo próprio paciente ainda precisa ser um módulo posterior.
- A proteção LGPD exige políticas, aviso de privacidade, retenção e processos da clínica; este starter não substitui avaliação jurídica/técnica.
- Cadastre a clínica como administrador antes de permitir acesso de funcionários. O modelo de demonstração não contém prontuário ou dados de saúde.
