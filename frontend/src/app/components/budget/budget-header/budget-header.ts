import {
  Component,
  signal,
  ElementRef,
  ViewChild,
  HostListener,
  ViewContainerRef,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faChevronCircleLeft,
  faChevronCircleRight,
  faArrowsTurnToDots,
  faWallet,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { BudgetStatus } from '../budget-status/budget-status';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { formatCurrencyWithSign } from '../../../shared/formatters';

@Component({
  selector: 'app-budget-header',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './budget-header.html',
  styleUrls: ['./budget-header.css'],
})
export class BudgetHeader {
  protected readonly icPrev = faChevronCircleLeft;
  protected readonly icNext = faChevronCircleRight;
  protected readonly icCheck = faArrowsTurnToDots;
  protected readonly icWallet = faWallet;
  protected readonly icStatus = faCheck;

  @Input() monthLabel = '';
  @Input() totalAvailable: number | null = null;
  @Input() availableCarryover: number | null = null;
  @Input() income: number | null = null;
  @Input() totalAssigned: number | null = null;
  @Input() totalActivity: number | null = null;
  @Input() loading = false;
  @Output() previousMonth = new EventEmitter<void>();
  @Output() nextMonth = new EventEmitter<void>();

  showStatus = signal(false);
  closing = signal(false);
  // Overlay reference when using CDK
  private overlayRef?: OverlayRef;
  // keep a reference to the attached component so we can trigger its close animation
  private attachedCompRef: any;

  @ViewChild('budgetAvailable', { read: ElementRef }) budgetAvailable?: ElementRef;

  onPreviousClick(event?: MouseEvent) {
    event?.preventDefault();
    if (this.loading) return;
    this.previousMonth.emit();
  }

  onNextClick(event?: MouseEvent) {
    event?.preventDefault();
    if (this.loading) return;
    this.nextMonth.emit();
  }

  toggleStatus() {
    if (this.loading || this.totalAvailable === null) {
      return;
    }
    const opening = !this.showStatus();
    if (opening) {
      const origin = this.budgetAvailable?.nativeElement as HTMLElement | undefined;
      if (!origin) return;

      // create overlay connected to the origin element
      const positionStrategy = this.overlay
        .position()
        .flexibleConnectedTo(origin)
        .withPositions([
          // prefer below
          {
            originX: 'center',
            originY: 'bottom',
            overlayX: 'center',
            overlayY: 'top',
            offsetY: 8,
          },
          // fallback above
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -8,
          },
        ])
        .withFlexibleDimensions(false)
        .withPush(true);

      this.overlayRef = this.overlay.create({
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
        panelClass: 'z-50',
      });

      const portal = new ComponentPortal(BudgetStatus, this.viewContainerRef);
      const compRef = this.overlayRef.attach(portal);
      // pass input
      if (compRef && compRef.instance) {
        compRef.instance.available = this.totalAvailable ?? 0;
        compRef.instance.carryover = this.availableCarryover ?? 0;
        compRef.instance.income = this.income ?? 0;
        compRef.instance.totalAssigned = this.totalAssigned ?? 0;
        compRef.instance.totalActivity = this.totalActivity ?? 0;
        compRef.instance.totalAvailable = this.totalAvailable ?? 0;
        compRef.instance.requestClose = () => this.closeOverlay();
      }
      this.attachedCompRef = compRef;

      // show status signal for template/logic parity
      this.showStatus.set(true);

      // close on backdrop click
      this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
      // also close on detachments or outside clicks handled by CDK
      this.overlayRef.detachments().subscribe(() => this.closeOverlay());

      // handle Escape inside the overlay and return focus to the origin when closed
      this.overlayRef.keydownEvents().subscribe((ev: KeyboardEvent) => {
        if (ev.key === 'Escape') this.closeOverlay();
      });
      // ensure origin receives focus again when overlay is closed
      this.overlayRef.detachments().subscribe(() => {
        try {
          origin.focus();
        } catch {}
      });
    } else {
      // close overlay and play any animation inside component if needed
      this.closeOverlay();
    }
  }

  private async closeOverlay() {
    const overlay = this.overlayRef;
    if (!overlay) return;

    // prevent re-entrancy: clear the shared references early so concurrent
    // callbacks won't try to operate on the same overlay again
    this.overlayRef = undefined;
    const attached = this.attachedCompRef;
    this.attachedCompRef = undefined;

    try {
      // if the attached component exposes startClose, call it and wait for animation
      if (attached && attached.instance && typeof attached.instance.startClose === 'function') {
        try {
          await attached.instance.startClose();
        } catch {
          // ignore animation errors and proceed to detach
        }
      }
    } finally {
      // best-effort detach/dispose on the captured overlay reference
      try {
        overlay.detach();
      } catch {}
      try {
        overlay.dispose();
      } catch {}
      this.showStatus.set(false);
    }
  }

  // position now handled by CDK Overlay; removed manual positioning helpers

  @HostListener('window:resize')
  onResize() {
    // CDK overlay repositioning handles resize when using reposition scroll strategy
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    // CDK overlay handles backdrop clicks; no manual outside-click detection needed
  }

  @HostListener('document:keydown', ['$event'])
  onEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.showStatus()) this.closeOverlay();
  }

  constructor(
    library: FaIconLibrary,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef
  ) {
    library.addIcons(
      faChevronCircleLeft,
      faChevronCircleRight,
      faArrowsTurnToDots,
      faWallet,
      faCheck
    );
  }

  formatCurrency(value?: string | number) {
    return formatCurrencyWithSign(value ?? 0, false);
  }
}
