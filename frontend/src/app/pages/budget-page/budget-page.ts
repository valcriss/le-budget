import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { BudgetHeader } from '../../components/budget/budget-header/budget-header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { BudgetMenu } from '../../components/budget/budget-menu/budget-menu';

@Component({
  selector: 'app-budget-page',
  imports: [Header, BudgetHeader, UiCard, BudgetMenu],
  templateUrl: './budget-page.html',
  styleUrl: './budget-page.css'
})
export class BudgetPage {

}
