# Clínica Vita Estética — modelo Essencial

Site institucional demonstrativo em Next.js, React, TypeScript e Tailwind CSS. Serviços, equipe, depoimentos, endereço e contatos são ilustrativos e precisam ser revisados pela clínica antes de publicar.

## Executar localmente

```powershell
npm install
npm run dev
```

Abra http://localhost:3000.

## Personalizar antes de apresentar ou publicar

- Atualize o nome, serviços, horários, equipe, imagens autorizadas e textos em `src/app/page.tsx` e `src/app/globals.css`.
- Cadastre o WhatsApp em `NEXT_PUBLIC_CLINIC_WHATSAPP` usando apenas país + DDD + telefone, com dígitos.
- Cadastre o e-mail público em `NEXT_PUBLIC_CLINIC_EMAIL` para exibi-lo no rodapé.
- Cadastre o endereço em `NEXT_PUBLIC_CLINIC_MAPS_QUERY` para exibir o mapa.
- Configure o formulário com `RESEND_API_KEY`, `CONTACT_TO_EMAIL` e `CONTACT_FROM_EMAIL`. Sem essas variáveis, ele informa que o envio está indisponível; nunca confirma uma mensagem que não foi enviada.
- Não apresente serviços, qualificações, depoimentos ou dados de contato demonstrativos como reais. Use fotografias autorizadas.

As variáveis ficam no arquivo `.env.local` durante o desenvolvimento local e no painel da hospedagem após publicar. Nunca coloque chaves secretas no código do navegador.

## Publicar

A configuração da Netlify está em `netlify.toml`; a hospedagem precisa executar `npm run build`. Configure as variáveis de ambiente no painel da hospedagem antes de publicar os contatos e o formulário personalizados.

Este é o modelo Essencial. Não inclui autenticação, banco de dados, painel administrativo ou agendamento online.
