# 🚀 Notas de Atualização — Sistema SANE
**Versão:** Abril 2026  
**Data:** 08/04/2026

---

## 🔒 Segurança

### Acesso à geração de PDF protegido por usuário
Antes, qualquer pessoa que soubesse o endereço de um orçamento poderia abrir o PDF, mesmo sem ter criado esse orçamento. Agora, cada vendedor só consegue abrir os PDFs dos **seus próprios** orçamentos. O administrador continua podendo ver todos normalmente.

### Cadastro de novos usuários só por administradores
O botão de convidar um novo membro da equipe agora verifica automaticamente que quem está tentando cadastrar é realmente um administrador, mesmo que alguém tente fazer isso de fora do sistema.

### Exclusão de arquivos protegida
As funções que deletam imagens e arquivos do sistema agora verificam se o usuário está logado antes de executar qualquer ação. Antes, essas funções estavam abertas.

### Verificação de URLs mais rigorosa
O sistema agora confere com precisão se os links de arquivos são realmente do servidor de imagens correto, evitando que links maliciosos sejam processados.

### Geração de senhas temporárias mais segura
As senhas temporárias criadas quando um novo membro entra no sistema agora são geradas de forma muito mais aleatória e difícil de prever.

---

## 🔑 Tela de Segurança — Nova Senha

A tela de troca de senha foi completamente reformulada. Agora ela conta com:

- **Indicador de força ao vivo** — Uma barra colorida que muda conforme você digita, mostrando se a senha está fraca, razoável ou forte.
- **Checklist interativo** — 5 requisitos que ficam marcados com ✅ verde conforme você atende a cada um:
  - Mínimo de 8 caracteres
  - Ao menos uma letra maiúscula
  - Ao menos uma letra minúscula
  - Ao menos um número
  - Ao menos um caractere especial (!@#$%...)
- **Botão de mostrar/ocultar senha** para facilitar a digitação
- **Confirmação em tempo real** — O campo de confirmação fica vermelho se as senhas não coincidem
- O botão de salvar só fica ativo quando **todos os requisitos** são atendidos

---

## ⚙️ Melhorias Gerais

### Páginas carregam mais rápido (índices no banco)
Foram adicionadas instruções especiais no banco de dados para que as buscas de orçamentos, clientes e produtos sejam muito mais rápidas à medida que o volume de dados cresce.

### Exclusão de orçamentos mais confiável
Agora quando um orçamento é excluído, os itens vinculados a ele são automaticamente removidos junto pelo banco de dados, eliminando qualquer possibilidade de dados "perdidos" ficarem acumulados.

### Valores de status bloqueados no banco
Os campos de status dos orçamentos e função dos usuários agora só aceitam os valores corretos (ex: "Rascunho", "Aprovado", "admin", "vendedor"). Isso evita erros causados por valores inesperados.

### Site reconhece o idioma correto
O sistema agora está configurado corretamente como português do Brasil. Isso melhora a compatibilidade com leitores de tela e ferramentas de acessibilidade.

### Limpeza de arquivos internos desnecessários
Alguns arquivos de teste que foram usados durante o desenvolvimento foram removidos do repositório, deixando o código mais limpo e organizado.

---

## 📋 Resumo Rápido

| O que mudou | Impacto para o usuário |
|---|---|
| PDF protegido por usuário | Vendedores veem apenas seus próprios PDFs |
| Convite de usuário verificado | Mais segurança no cadastro da equipe |
| Deleção de imagens autenticada | Proteção extra nas operações do sistema |
| Nova tela de senha | Experiência guiada para criar senhas fortes |
| Banco de dados mais rápido | Listas carregam mais rápido com mais dados |
| Limpeza automática de dados excluídos | Menos "sujeira" acumulada no banco |
| Restrições de valores no banco | Menos chance de erros inesperados |
