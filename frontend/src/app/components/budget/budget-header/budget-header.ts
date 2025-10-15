import { Component, signal, ElementRef, ViewChild, HostListener } from '@angular/core';
import { NgStyle } from '@angular/common';
import { NgIf } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faChevronCircleLeft, faChevronCircleRight, faArrowsTurnToDots, faWallet, faCheck } from '@fortawesome/free-solid-svg-icons';
import { BudgetStatus } from '../budget-status/budget-status';

@Component({
  selector: 'app-budget-header',
  standalone: true,
  imports: [FontAwesomeModule, BudgetStatus, NgIf, NgStyle],
  templateUrl: './budget-header.html',
  styleUrls: ['./budget-header.css']
})
export class BudgetHeader {
  protected readonly icPrev = faChevronCircleLeft;
  protected readonly icNext = faChevronCircleRight;
  protected readonly icCheck = faArrowsTurnToDots;
  protected readonly icWallet = faWallet;
  protected readonly icStatus = faCheck;

  showStatus = signal(false);
  protected readonly available = '1 250,00 €';
  tooltipStyle: { [k: string]: string } = {};

  @ViewChild('budgetAvailable', { read: ElementRef }) budgetAvailable?: ElementRef;
  @ViewChild('budgetTooltip', { read: ElementRef }) budgetTooltip?: ElementRef;

  toggleStatus(){
    this.showStatus.set(!this.showStatus());
    // compute position when opening
    if (this.showStatus()) {
      setTimeout(()=> this.computeTooltipPosition(), 0);
    }
  }

  computeTooltipPosition(){
    const avail = this.budgetAvailable?.nativeElement as HTMLElement | undefined;
    const tip = this.budgetTooltip?.nativeElement as HTMLElement | undefined;
    if (!avail || !tip) return;

    const rect = avail.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.left;

    // default center above the element
    let left = rect.left + rect.width/2 - tipRect.width/2;
    // prevent overflow left/right
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

    // place tooltip below by default (top: rect.bottom) with small offset
    let top = rect.bottom + 8;

    // if not enough space below, place above
    if (rect.bottom + tipRect.height + 16 > window.innerHeight) {
      top = rect.top - tipRect.height - 8;
    }

    this.tooltipStyle = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      zIndex: '9999'
    };
  }

  @HostListener('window:resize')
  onResize(){
    if (this.showStatus()) this.computeTooltipPosition();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent){
    const target = event.target as Node;
    const avail = this.budgetAvailable?.nativeElement as HTMLElement | undefined;
    const tip = this.budgetTooltip?.nativeElement as HTMLElement | undefined;
    if (!avail) return;
    if (this.showStatus() && tip && !avail.contains(target) && !tip.contains(target)){
      this.showStatus.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onEscape(event: KeyboardEvent){
    if (event.key === 'Escape' && this.showStatus()) this.showStatus.set(false);
  }

  constructor(library: FaIconLibrary){
    library.addIcons(faChevronCircleLeft, faChevronCircleRight, faArrowsTurnToDots, faWallet, faCheck);
  }

}
