import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { BudgetHeader } from '../../components/budget/budget-header/budget-header';

@Component({
  selector: 'app-budget-page',
  imports: [Header, BudgetHeader],
  templateUrl: './budget-page.html',
  styleUrl: './budget-page.css'
})
export class BudgetPage {

}
