# Règles automatiques du budget

Ce document récapitule les mises à jour automatisées qui touchent les tables `BudgetMonth` et `BudgetCategory`. Pour chaque règle, on précise le déclencheur ainsi que le calcul appliqué.

---

## BudgetMonth

| Champ | Calcul appliqué | Déclencheurs connus |
| --- | --- | --- |
| `income` | Somme des montants des transactions associées à des catégories de type `INCOME` ou `INITIAL` dont la date est comprise dans le mois courant, **ajoutée** aux montants des transactions de type `INCOME_PLUS_ONE` du mois précédent. | `TransactionsService.recalculateBudgetImpacts` → `recalculateBudgetMonthSummary` (création/modification/suppression de transaction, y compris transaction initiale).<br>`BudgetService.updateCategory` (après modification manuelle d’une enveloppe).<br>`BudgetService.getMonth` lorsqu’un mois est créé à la volée. |
| `availableCarryover` | Reprise du champ `available` du mois précédent ; vaut `0` s’il n’existe pas de mois précédent. | Même déclencheurs que ci-dessus. |
| `assigned` | Somme de tous les `assigned` des lignes `BudgetCategory` rattachées au mois. | Même déclencheurs que ci-dessus. |
| `activity` | Somme des montants des transactions de type `TransactionType.NONE` rattachées à des catégories de type `EXPENSE` et datées dans le mois. | Même déclencheurs que ci-dessus. |
| `available` | `income + availableCarryover - assigned`. | Même déclencheurs que ci-dessus. |

> Notes :
> - La méthode `TransactionsService.recalculateBudgetMonthSummary` encapsule ces calculs. Elle est appelée pour chaque mois impacté par une transaction (mois courant et, le cas échéant, le mois suivant pour les revenus `INCOME_PLUS_ONE`).
> - Lorsqu’un `GET /budget/months/{monthKey}` provoque la création d’un nouveau mois, la recalculation est exécutée immédiatement afin de retourner des totaux cohérents.

---

## BudgetCategory

| Champ | Calcul appliqué | Déclencheurs connus |
| --- | --- | --- |
| `assigned` | Valeur définie explicitement par l’utilisateur (via `BudgetService.updateCategory`). Aucune recalculation automatique hormis la création initiale fixée à `0`. | Création automatique de la structure (valeur initiale `0`).<br>Mise à jour directe via `updateCategory`. |
| `activity` | Somme des montants des transactions de la catégorie (type `EXPENSE`) dont la date est comprise dans le mois considéré. | `TransactionsService.recalculateBudgetImpacts` (après création/mise à jour/suppression de transaction liée à la catégorie). |
| `available` | Calcul en deux temps :<br>1. Lors d’un `updateCategory`, si `assigned` ou `activity` sont modifiés sans fournir `available`, la valeur est recalculée à `assigned + activity` pour le mois en cours.<br>2. Après chaque recalcul d’activité, toutes les lignes de la catégorie sont retraitées chronologiquement : `available = Σ assigned + Σ activity` (somme cumulée depuis l’origine pour propager les fonds restants sur les mois suivants). | `BudgetService.updateCategory` (règle 1).<br>`TransactionsService.recalculateBudgetImpacts` (règle 2). |

Autres règles structurelles :

- À chaque fois qu’une transaction touche une catégorie de dépenses, `recalculateBudgetImpacts` vérifie que la structure `BudgetMonth` → `BudgetCategoryGroup` → `BudgetCategory` existe pour le mois concerné et la crée au besoin (valeurs initiales `assigned = 0`, `activity = 0`, `available = 0`).
- Lors de la consultation d’un mois (`GET /budget/months/{monthKey}`), `recalculateBudgetMonthForUser` rejoue l’intégralité de la chronologie budgétaire : pour chaque mois de l’utilisateur (depuis le plus ancien jusqu’au plus récent), la fonction recalcule `income`, `availableCarryover`, `assigned`, `activity`, `available`, ainsi que les `activity`/`available` cumulés de chaque `BudgetCategory`.
- Les dépenses de type `EXPENSE` alimentent également la somme `activity` du mois concerné, ce qui déclenche ensuite la recalculation des totaux `BudgetMonth`.
- Les transactions associées à des catégories de type `INCOME_PLUS_ONE` marquent à recalcul le mois suivant pour refléter le décalage d’un mois des revenus.

---

## Synthèse des déclencheurs principaux

- **Transactions** (`create`, `update`, `delete`, création initiale) → recalcul automatique des budgets via `recalculateBudgetImpacts`, puis `recalculateBudgetMonthSummary` sur tous les mois impactés.
- **Mise à jour manuelle d’une catégorie de budget** (`PATCH /budget/months/:monthKey/categories/:categoryId`) → recalcul du mois ciblé et ajuste `available` si nécessaire.
- **Lecture d’un mois budgétaire** (`GET /budget/months/{monthKey}`) → si le mois est créé dynamiquement, recalcul immédiat de ses totaux avant de renvoyer la réponse.
