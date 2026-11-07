# Supabase — configuração Modelo Profissional

1. Crie um projeto Supabase de desenvolvimento.
2. No SQL Editor do projeto, cole e execute `supabase/migrations/202611050001_professional_clinic.sql`.
3. Para mostrar horários livres, ocupados e bloqueados e habilitar pedidos recorrentes para todas as quartas (ou outro dia da semana) selecionadas, abra uma nova consulta no SQL Editor, cole e execute `supabase/migrations/202611050002_slot_statuses.sql`. A função recorrente valida todas as datas antes de criar qualquer agendamento; se uma estiver ocupada, rejeita a série inteira. A atualização cria funções e permissões e não apaga agendamentos.
4. Para permitir conversas diretas pelo WhatsApp de cada profissional, execute `supabase/migrations/202611050003_professional_whatsapp.sql` no SQL Editor. Depois, preencha o número de cada profissional na coluna `whatsapp_phone` da tabela `professionals` em Table Editor, com DDI e DDD (somente números, por exemplo `55` + DDD + telefone). Sem esse contato cadastrado, o cartão informa que o número ainda não está disponível.
5. Em Project Settings → API, copie Project URL e anon/public key. Adicione ao `.env.local` (sem `service_role`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
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

## Configuração do Modelo Premium

Depois das migrações anteriores, execute `supabase/migrations/202611060001_premium_patient_portal.sql` no SQL Editor. Ela cria a área do paciente, os pedidos de cancelamento/remarcação, os relatórios agregados e reforça as permissões de agenda. Não apaga os agendamentos existentes.

Em Authentication → URL Configuration, permita estes endereços de retorno:

- `http://localhost:3000/auth/callback` para desenvolvimento.
- `https://SEU-DOMINIO/auth/callback` para produção.

O e-mail de confirmação de cadastro e o de redefinição de senha dependem da configuração de SMTP/Authentication no Supabase. As telas só confirmam o pedido depois da resposta do Supabase. O portal mostra apenas os dados e agendamentos vinculados ao usuário autenticado; não contém prontuário.

Para usar **Equipe → Enviar convite** e ativar/desativar contas pela interface, configure `SUPABASE_SECRET_KEY` como variável secreta no ambiente de servidor (e no provedor de hospedagem). Copie a chave **Secret** na seção API Keys do Supabase; a chave antiga `service_role` também é aceita. Em desenvolvimento, coloque-a apenas no `.env.local`, sem prefixo `NEXT_PUBLIC_`, e reinicie a aplicação. Essa chave tem acesso elevado e nunca deve ir para o navegador, para o GitHub ou para um arquivo público. Sem ela, o painel ainda permite gerenciar profissionais e horários, mas convites e controle de contas ficam indisponíveis; nesse caso, crie contas em Authentication → Users e vincule os perfis administrativos pelo SQL Editor conforme abaixo.

Defina `NEXT_PUBLIC_SITE_URL` como `http://localhost:3000` localmente e como o endereço HTTPS final em produção. Configure esse mesmo domínio como destino permitido no Supabase.

## Cadastro de paciente com código de confirmação por e-mail

Para realmente impedir que alguém use um endereço de e-mail que não controla:

1. No Dashboard do Supabase, abra **Authentication → Sign In / Providers → Email** e ative **Confirm email**.
2. Abra **Authentication → Email Templates → Confirm signup**. Configure o assunto e o corpo para mostrar `{{ .Token }}` (código numérico) em vez de depender apenas de `{{ .ConfirmationURL }}`. Exemplo de corpo:

```html
<h2>Confirme seu e-mail — Clínica Vita</h2>
<p>Digite o código abaixo na tela de cadastro para confirmar que este e-mail é seu:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Se você não criou esta conta, ignore esta mensagem.</p>
```

3. Salve o modelo. O cadastro do site então pede o código e só libera a conta depois da validação.
4. Faça o teste com um endereço real que você consiga abrir. Contas criadas enquanto **Confirm email** estava desligado podem já ter sido confirmadas automaticamente.

O envio padrão do Supabase serve para testes e tem limites de entrega. Para vender o site a uma clínica, configure um SMTP próprio no Supabase; a chave `RESEND_API_KEY` do formulário de contato não configura automaticamente o envio de códigos do Supabase Auth.

## Configuração de produção

No provedor de hospedagem, configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL`. Adicione `SUPABASE_SECRET_KEY` como variável secreta apenas se for usar convites e controle de contas da equipe. Configure `NEXT_PUBLIC_CLINIC_WHATSAPP` para o contato real da clínica e as variáveis do Resend se quiser receber mensagens do formulário institucional. Crie contas com acesso mínimo necessário e substitua profissionais, preços, endereço e horários fictícios antes de publicar para uma clínica. Nunca use a chave `secret` ou `service_role` no cliente ou em `NEXT_PUBLIC_*`.

## Observações de segurança e escopo

- A disponibilidade e criação são RPCs do Postgres; a restrição de exclusão impede sobreposição mesmo se duas pessoas reservarem ao mesmo tempo.
- A página pública consulta somente o estado do horário (`available`, `booked` ou `blocked`); não exibe nomes, contatos ou IDs de pacientes para indicar horários ocupados.
- Pedidos para várias datas criam uma solicitação pendente em cada data para o mesmo paciente, profissional e horário; a série é toda aceita ou toda rejeitada.
- O visitante público recebe apenas o UUID de confirmação; RLS impede a leitura pública de pacientes e agendamentos.
- A confirmação é uma solicitação pendente. Mensagem por e-mail, lembrete e WhatsApp não estão ativados neste módulo; não mostramos que algo foi enviado.
- O portal do paciente permite pedir cancelamento ou sugerir remarcação. A equipe precisa revisar o pedido; a alteração só é efetivada após aprovação e nova validação da disponibilidade.
- O Modelo Premium inclui relatórios sem dados pessoais, exportados em CSV, e auditoria das principais ações administrativas.
- Confirmações de consultas, lembretes e notificações por WhatsApp não são enviados automaticamente neste starter. A conexão com Supabase Auth é real; SMTP e integrações externas precisam ser configurados separadamente.
- A proteção LGPD exige políticas, aviso de privacidade, retenção e processos da clínica; este starter não substitui avaliação jurídica/técnica.
- Cadastre a clínica como administrador antes de permitir acesso de funcionários. O modelo de demonstração não contém prontuário ou dados de saúde.
## Login social e pagamento online — Modelo Premium

O portal permite criar conta por e-mail e senha ou continuar com Google/Facebook. Para ativar cada botão, configure o provedor em Supabase → Authentication → Sign In / Providers e cadastre as credenciais OAuth da clínica. No Google, cadastre como URI de redirecionamento a URL de callback exibida pelo Supabase. No Facebook, habilite a permissão de e-mail e configure o mesmo callback. Em Authentication → URL Configuration, defina Site URL para o domínio HTTPS final e inclua em Redirect URLs http://localhost:3000/auth/callback e https://SEU-DOMINIO/auth/callback. Para prévias Netlify, adicione uma regra restrita ao endereço de prévia da equipe, como https://**--SEU-SITE.netlify.app/**. No formulário de cada provedor (Google e Facebook), use o callback mostrado pelo Supabase; geralmente é https://SEU-PROJETO.supabase.co/auth/v1/callback. Não habilite o provedor até inserir as credenciais corretas.

A migração adicional supabase/migrations/202611060002_patient_auth_and_checkout.sql acrescenta os estados de pagamento, cria a reserva temporária de 20 minutos e vincula apenas e-mails confirmados ao perfil do próprio paciente. Abra uma consulta nova no SQL Editor, cole somente essa nova migração, execute uma vez e confirme que terminou sem erro.

Para ativar checkout online, crie uma aplicação no Mercado Pago e cadastre no ambiente do servidor:
- MERCADOPAGO_ACCESS_TOKEN (token de produção somente no ambiente de produção; use credenciais de teste no desenvolvimento).
- MERCADOPAGO_WEBHOOK_SECRET (segredo de assinatura da notificação de pagamento).
- SUPABASE_SECRET_KEY (ou a chave antiga SUPABASE_SERVICE_ROLE_KEY), exclusivamente no servidor.
- NEXT_PUBLIC_SITE_URL com o endereço HTTPS publicado.

No painel Mercado Pago, crie uma notificação para pagamentos apontando para https://SEU-DOMINIO/api/payments/webhook, selecione eventos de pagamento e copie o segredo de assinatura para MERCADOPAGO_WEBHOOK_SECRET. O servidor valida a assinatura, consulta o pagamento diretamente no Mercado Pago e só então confirma o agendamento. A volta do navegador nunca marca o pagamento como concluído. Até as credenciais e o webhook estarem conectados, o formulário explica que o checkout não está ativo e mantém o caminho WhatsApp funcionando.

A clínica escolhe em cada projeto se mostra WhatsApp, checkout online ou ambos. O modelo demonstrativo deixa a escolha visível e usa o preço cadastrado no serviço; o servidor consulta o banco e não aceita preço enviado pelo navegador. Reservas online não pagas são liberadas após 20 minutos. Uma confirmação que chegue depois da expiração não reabre automaticamente um horário já liberado; a equipe deve conferir o caso e tratar eventual reembolso no Mercado Pago.

Os links Entrar / criar conta e o cadastro público são exclusivamente do portal de pacientes. Não há cadastro público de administrador. O painel da equipe está em /admin; somente usuários previamente cadastrados em Authentication e vinculados a staff_profiles ativos podem entrar. Para criar o primeiro dono da clínica, use as instruções do item 10 acima; não compartilhe a conta administrativa com pacientes.
