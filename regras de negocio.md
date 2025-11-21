1. Visão geral do app

Nome provisório: FitPantry (muda depois se quiser)

Objetivo:
Aplicativo mobile (Android e iOS) para pessoas fitness que:

Cadastram metas (ganhar massa, perder peso, bodybuilder, recomposição corporal etc.).

Informam o que têm em casa (foto da geladeira/dispensa ou lista de ingredientes).

Recebem:

Receitas fitness personalizadas;

Planos de dieta (refeições diárias/semanais);

Listas de compras semanais/mensais alinhadas à dieta e às metas.

IA entra como motor de:

Geração de receitas;

Ajuste de macro/micro nutrientes conforme objetivo;

Sugestão de compras considerando estoque atual.

2. Perfis de usuário (personas)

Iniciante Fitness

Objetivo: perder peso, melhorar saúde, reduzir gordura.

Precisa: receitas simples, poucos ingredientes, modo passo a passo.

Intermediário / “Marombeiro” casual

Objetivo: ganhar massa magra, controlar macros.

Precisa: informação de macros por refeição, quantidade de proteína/dia.

Bodybuilder / Atleta

Objetivo: preparação para competição, cutting/bulking.

Precisa: alta precisão em macros, divisão de refeições, pesagem de alimentos.

Pessoa ocupada

Objetivo: se manter saudável com pouco tempo.

Precisa: receitas rápidas, batch cooking, listas de compras práticas.

3. Fluxos principais do app
3.1. Onboarding & Cadastro

Fluxo:

Tela de boas-vindas (explica benefício em 3 pontos).

Cadastro:

Login com e-mail + senha ou Apple ID ou Google Sign-In.

Aceite de Termos de Uso e Política de Privacidade (LGPD/GDPR compliant).

Perguntas iniciais:

Sexo, idade, altura, peso atual;

Nível de atividade física (sedentário, leve, moderado, intenso);

Objetivo principal:

Perder peso;

Ganhar massa;

Manter peso;

Bodybuilding (pre-contest, off-season);

Saúde geral.

Tempo aproximado para atingir a meta (ex: 3/6/12 meses).

Preferências e restrições alimentares:

Vegetariano, vegano, low carb, cetogênico, high protein, sem lactose, sem glúten etc.

Alergias: (ex: amendoim, frutos do mar).

Regras de negócio:

🔹 Dados mínimos obrigatórios: idade, altura, peso, sexo, objetivo.

🔹 Sem esses dados, IA não gera dieta completa, apenas receitas genéricas.

🔹 TMB + TDEE são estimados com fórmulas padrão (Mifflin-St Jeor ou outra) – resultado é apenas sugestão, sem caráter médico.

🔹 Variar “agressividade” da meta:

Perda de peso saudável: -0,25 a -0,75 kg/semana (déficit calórico moderado).

Ganho de massa: +0,25 a +0,5 kg/semana (superávit moderado).

Bodybuilding pode permitir ajustes mais agressivos sob responsabilidade do usuário.

3.2. Dashboard principal (Home)

Elementos sugeridos de UI:

Cabeçalho:

Foto/avatar.

Saudação personalizada: “Bom dia, João. Hoje você tem X refeições planejadas.”

Cards principais:

Meta atual

Peso atual vs peso objetivo

Barra de progresso.

Macros do dia

Proteínas / Carboidratos / Gorduras / Calorias consumidas vs plano.

Refeições de hoje

Lista com: café da manhã, almoço, jantar, snacks com status: pendente / concluída.

O que tem em casa? (Atalho)

Botão: “Usar ingredientes da geladeira”.

Lista de compras

Próxima lista ativa (semana/mês), com indicador: “72% dos itens já comprados”.

Regras de negócio:

Dashboard deve ser diferente para:

Usuário com dieta ativa (mostra plano).

Usuário sem dieta configurada (call-to-action para configurar as metas ou gerar dieta).

Atualizações de progresso:

Ao marcar refeição como “consumida”, o app recalcula macros do dia.

Suporte a modo claro/escuro (UX + economia de bateria).

3.3. Captura de ingredientes (Geladeira / despensa)

Opções de input:

Foto da geladeira/despensa

Acesso à câmera (Android e iOS).

IA faz:

Detecção de objetos (ex: ovo, tomate, frango, arroz, leite).

Sugere lista de ingredientes detectados para confirmação manual do usuário.

Texto

Campo de texto com autocomplete (ex: começar a digitar “fra… → frango, farinha, framboesa”).

Possibilidade de colar uma lista.

Pantry fixa (estoque)

Tela “Minha despensa”:

Lista de ingredientes que a pessoa mantém em casa com frequência.

Quantidade aproximada (unidade, gramas, litros) – opcional.

Regras de negócio:

Antes de salvar, sempre pedir confirmação dos ingredientes detectados na foto.

Permitir marcar ingredientes como:

“Acabando”;

“Acabou”;

“Tenho muito”.

Receitas geradas devem:

Priorizar itens marcados como “Acabando” (anti-desperdício).

Evitar itens marcados como “Acabou”.

3.4. Geração de receitas fitness

Fluxo:

Usuário seleciona:

Ingredientes disponíveis (foto ou lista).

Tipo de refeição: café, almoço, jantar, snack, pré/pos-treino.

Tempo máximo de preparo (ex: 10, 20, 30+ min).

Equipamentos: fogão, micro-ondas, airfryer, liquidificador etc.

App envia contexto pra IA:

Perfil do usuário (meta, restrições, macros do dia).

Ingredientes disponíveis.

Preferências anteriores (ex: já curtiu receitas high protein).

IA retorna:

3 a 5 sugestões de receitas.

Para cada receita:

Nome;

Lista de ingredientes e quantidades estimadas;

Modo de preparo passo a passo;

Macros estimadas (kcal, P, C, G);

Dicas (substituições possíveis).

Regras de negócio:

Se o usuário tiver meta de perda de peso, evitar:

Receitas com densidade calórica muito alta.

Refeições com excesso de gordura saturada.

Se o usuário for bodybuilder/ganho de massa:

Focar em proteína e calorias suficientes.

IA nunca deve sugerir algo que viole:

Alergias cadastradas;

Restrições religiosas (se coletadas).

Permitir o usuário:

Favoritar receita;

Editar quantidades;

Substituir ingredientes (ex: trocar arroz por batata doce).

3.5. Geração de plano alimentar (dieta)

Fluxo:

Tela “Criar minha dieta”:

Escolher duração:

1 semana;

2 semanas;

1 mês.

Nível de precisão:

Básico (sem pesar alimento, medidas caseiras);

Intermediário (gramas aproximados);

Avançado (gramagem precisa, macros por refeição).

App calcula:

Calorias diárias alvo (TDEE ± déficit/superávit).

Divisão de macros (ex: 30% P / 40% C / 30% G; ou custom de bodybuilder).

IA gera:

Número de refeições por dia (customizável: ex. 3–6).

Cardápio completo, com:

Nome da refeição;

Alimentos/receitas sugeridas;

Horários sugeridos (opcional).

Usuário revisa e pode:

Trocar refeições específicas;

Trocar receita mantendo macros aproximados;

Fixar certas refeições (ex: manter sempre o mesmo pequeno almoço).

Regras de negócio:

Dieta deve:

Respeitar restrições, preferências e ingredientes mais comuns na despensa do usuário.

Sugerir variedade (evitar repetir exatamente a mesma refeição todos os dias, a menos que o usuário peça).

Ajustes automáticos:

Se o usuário registrar peso toda semana, o app pode sugerir:

Aumentar/reduzir calorias;

Mudar macros;

Enviar alerta: “Sua evolução está mais lenta/rápida que o previsto. Deseja ajustar a dieta?”.

3.6. Lista de compras (semanal/mensal)

Fluxo:

Usuário escolhe:

Período: semana atual, próxima semana ou mês.

App analisa:

Dieta gerada;

Itens disponíveis na “Minha despensa”.

App gera lista de compras:

Agrupada por categoria: proteínas, carbs, vegetais, frutas, laticínios, suplementos.

Quantidades aproximadas:

Ex: 2,5 kg de peito de frango, 1 kg arroz integral, 12 ovos etc.

Modo “Check-list”:

Usuário marca o que já comprou.

Sincroniza com a despensa para ajustar estoque.

Regras de negócio:

Lista nunca deve incluir itens que o usuário declarou que não consome (religião, veganismo etc.).

Se o usuário marcar que não tem micro-ondas, airfryer etc., evitar receitas que dependam exclusivamente disso.

Ao mudar a dieta, oferecer a opção de atualizar a lista de compras.

3.7. Progresso e histórico

Tela de Progresso:

Gráfico com:

Peso ao longo do tempo;

Medidas (cintura, braço, quadril etc.);

Adesão à dieta (percentual de refeições marcadas como realizadas).

Highlights:

“Você já perdeu X kg em Y semanas.”

“Você bateu a meta de proteína em Z dias seguidos.”

Regras de negócio:

Permitir registrar peso e medidas manualmente.

Opcional: integração futura com wearables (Apple Health, Google Fit).

4. Regras de negócio gerais da IA

Personalização forte

Sempre considerar:

Meta atual;

Restrição alimentar;

Macro diário restante;

Horário da refeição (pré/pos treino, noite etc.).

Segurança e responsabilidade

Mensagens no app deixam claro:

“As recomendações são sugestivas e não substituem orientação de nutricionista ou médico.”

Evitar:

Sugestões extremas (calorias muito baixas ou muito altas);

Dietas muito restritivas sem carboidratos por longos períodos, a menos que o usuário já selecione esse estilo (ex: cetogênica).

Aprendizado com feedback

Se usuário constantemente:

Deleta uma refeição;

Troca o tipo;

Marca “não gostei” de receita;

IA ajusta recomendações futuras (evita padrões parecidos).

5. Regras e requisitos específicos Android & iOS
5.1. Permissões

Câmera:

Solicitar permissão apenas no momento de uso.

Android: CAMERA + READ_EXTERNAL_STORAGE (se pegar da galeria).

iOS: NSCameraUsageDescription, NSPhotoLibraryUsageDescription no Info.plist.

Notificações push:

Solicitar permissão de forma contextual (“Quer receber lembretes das refeições?”).

Saúde (futuro):

iOS: integração com HealthKit (necessita descrições claras no Info.plist).

Android: possível integração com Google Fit.

5.2. UX nativo

iOS:

Gestos de swipe para voltar.

Bottom tab bar com 3–5 abas principais:

Home, Receitas, Dieta, Compras, Perfil.

Tipografia e spacing mais “clean”, estilo Apple.

Android:

Uso de Material Design (ou Material You).

Floating Action Button para ações como “Adicionar ingredientes” ou “Criar nova receita”.

Respeitar botão “voltar” nativo.

5.3. Performance e offline

Manter:

Dados principais (perfil, receitas favoritas, dieta atual) em cache local.

Comportamento offline:

Usuário consegue visualizar dieta, receitas salvas e despensa.

Geração de novas receitas/dietas depende de conexão (chamada de IA).

6. Estrutura básica de dados (alto nível)

Entidades principais:

User

id, nome, e-mail, senha/ID social

altura, peso, sexo, idade

histórico de peso/medidas

Goal (Meta)

tipo (perda, ganho, manutenção, bodybuilding)

prazo

calorias alvo

macros alvo

Preference

dieta (low carb, vegano etc.)

alergias

equipamentos disponíveis

tempo médio disponível pra cozinhar

PantryItem

nome, categoria

quantidade aproximada

status (tenho / acabando / acabou)

Recipe

id

nome

lista de ingredientes (+ quantidades)

passos

macros

tags (rápida, pré-treino, low carb etc.)

MealPlan (Plano alimentar)

período (data início / fim)

dias → refeições → receitas

ShoppingList

período (semana/mês)

lista de itens (nome, quantidade, status comprado)

7. Próximos passos (práticos)

Se quiser, no próximo passo posso:

Desenhar lista de telas (screen-by-screen) com layout pro UI/UX;

Criar user stories no formato:
“Como [tipo de usuário], eu quero [ação] para [benefício]”;

Montar um MVP com o que é essencial pra v1 e o que fica pra v2/v3.