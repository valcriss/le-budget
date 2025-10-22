import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { AccountsList } from '../../components/accounts/accounts-list/accounts-list';

@Component({
  selector: 'app-account-page',
  imports: [Header, UiCard, AccountsList],
  templateUrl: './account-page.html',
  styleUrl: './account-page.css'
})
export class AccountPage {

}
