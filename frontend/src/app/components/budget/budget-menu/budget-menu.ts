import { Component, inject } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { CategoryCreateDialog } from '../category-create-dialog/category-create-dialog';

@Component({
  selector: 'app-budget-menu',
  standalone: true,
  imports: [FontAwesomeModule, DialogModule],
  templateUrl: './budget-menu.html',
  styleUrls: ['./budget-menu.css'],
})
export class BudgetMenu {
  protected readonly icCategoryGroup = faPlusSquare;
  private readonly dialog = inject(Dialog);

  constructor(library: FaIconLibrary) {
    library.addIcons(faPlusSquare);
  }

  openCreateGroupDialog(): void {
    this.dialog.open(CategoryCreateDialog, {
      data: {
        mode: 'create',
        parentCategoryId: null,
        title: 'Créer un groupe de catégorie',
        nameLabel: 'Nom du groupe',
        placeholder: 'Ex : Logement',
      },
    });
  }
}
