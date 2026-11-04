# Clínica Vita — modelo Essencial

Site institucional demonstrativo em Next.js, React, TypeScript e Tailwind CSS.

## Executar localmente

```powershell
npm install
npm run dev
```

Abra http://localhost:3000. Para validar o build antes de publicar:

```powershell
npm run lint
npm run build
```

## Antes de publicar

O projeto usa dados demonstrativos. Atualize o nome, endereço, telefone, e-mail, profissionais, registros profissionais, serviços, links sociais e textos em `src/app/page.tsx`. Substitua as imagens de referência por imagens autorizadas da clínica. Confirme o endereço do mapa e o número do WhatsApp.

O formulário valida os campos no navegador, mas ainda não envia mensagens. Conecte um serviço de recebimento e só então troque o aviso por uma confirmação de envio. Não publique dados fictícios como se fossem reais.

## Publicar na Netlify

1. Crie um repositório vazio no GitHub pelo site, sem README, licença ou `.gitignore` adicionais.
2. Configure `git config user.name` e `git config user.email` com seu nome e e-mail do GitHub.
3. Na pasta do projeto, rode:

```powershell
git branch -M main
git add .
git commit -m "Clínica Vita Essencial"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

4. No painel da Netlify, escolha **Add new project → Import an existing project**, conecte o GitHub, selecione o repositório e publique.
5. A Netlify detecta Next.js. O arquivo `netlify.toml` define `npm run build` e Node.js 22.

Após conectar GitHub e Netlify, novos commits na branch principal podem disparar implantações automáticas. A conta e as permissões precisam ser configuradas pelo proprietário no navegador.

## Observação

Esta versão é o modelo Essencial. Não contém banco de dados, autenticação ou agendamento. O formulário não transmite dados pessoais até a configuração de um serviço de envio.
