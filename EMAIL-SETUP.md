# Configuração do envio de e-mail

O formulário envia as mensagens pela API do servidor em `/api/contact`, usando Resend. A chave secreta não é enviada ao navegador.

## Configuração local

1. Crie uma conta no Resend e gere uma API key.
2. Para envio de produção, adicione e valide um domínio no Resend. O endereço remetente precisa pertencer a esse domínio validado.
3. Copie `.env.example` para `.env.local` e preencha:
   - `RESEND_API_KEY`: chave privada da API, nunca use prefixo `NEXT_PUBLIC_`.
   - `CONTACT_TO_EMAIL`: endereço que receberá as mensagens.
   - `CONTACT_FROM_EMAIL`: nome e endereço remetente autorizado no Resend.
4. Reinicie `npm run dev` após salvar as variáveis.
5. Envie uma mensagem de teste sem dados médicos e confirme o recebimento e a resposta ao endereço informado.
6. Configure as mesmas variáveis no painel da hospedagem e publique novamente.

Antes de validar um domínio, o Resend pode limitar o destinatário a um endereço de teste verificado da própria conta. A confirmação mostrada pelo site só aparece depois que a API aceita a mensagem; ela indica aceitação pelo serviço, não garante que chegou à caixa de entrada. Verifique entrega e spam no Resend.

As mensagens contêm dados de contato. Não solicite informações clínicas no formulário. Defina prazo de retenção, aviso de privacidade e controle de acesso ao e-mail conforme a operação real da clínica.

A proteção contra repetição nesta demonstração é em memória por instância e não substitui um serviço de rate limiting distribuído para produção.
