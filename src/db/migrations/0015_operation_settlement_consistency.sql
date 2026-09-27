-- Keep operation terminal state and point settlement mutually consistent.
-- This closes the race where one worker captures points while another
-- concurrently marks the same operation failed/cancelled.

CREATE TRIGGER IF NOT EXISTS operation_settlement_terminal_guard BEFORE UPDATE OF status ON operations WHEN ( NEW.status IN ('failed', 'cancelled') AND OLD.settlement_kind = 'capture' ) OR ( NEW.status IN ('succeeded', 'delivered') AND OLD.settlement_kind = 'release' ) BEGIN SELECT RAISE(ABORT, 'Operation terminal state conflicts with settlement'); END;

CREATE TRIGGER IF NOT EXISTS operation_settlement_kind_guard BEFORE UPDATE OF settlement_kind ON operations WHEN OLD.settlement_kind IS NOT NULL AND NEW.settlement_kind IS NOT OLD.settlement_kind BEGIN SELECT RAISE(ABORT, 'Operation settlement cannot change after finalization'); END;

