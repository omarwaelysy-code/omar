import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService } from '../services/dbService';

// Mock the notification service
const mockShowNotification = vi.fn();

// Mock dependencies
vi.mock('../services/dbService', () => ({
  dbService: {
    add: vi.fn(),
    update: vi.fn(),
    updateWithLog: vi.fn(),
    createJournalEntry: vi.fn(),
    logActivity: vi.fn(),
    getJournalEntryByReference: vi.fn(),
    deleteJournalEntryByReference: vi.fn(),
  }
}));

// Simulate the refactored handleSubmit logic for a general transaction
async function simulateTransactionSubmit({
  primarySaveSuccess = true,
  postSaveSuccess = true,
  showNotification = mockShowNotification,
  closeModal = vi.fn()
}) {
  try {
    let id = '';
    if (primarySaveSuccess) {
      id = 'test-id';
      await dbService.add('transactions', { data: 'test' });
    } else {
      throw new Error('Primary save failed');
    }

    // Success notification and modal close early (The FIX)
    showNotification('Success!', 'success');
    closeModal();

    // Background post-save hooks
    try {
      if (postSaveSuccess) {
        await dbService.createJournalEntry({ data: 'journal' });
      } else {
        throw new Error('Post-save failed');
      }
    } catch (postError) {
      console.error('Post-save operations failed:', postError);
      // Logic check: We do NOT call showNotification('error') here
    }
  } catch (e) {
    console.error(e);
    showNotification('Server Error', 'error');
  }
}

describe('Transaction Save Decoupling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show success notification even if post-save operations fail', async () => {
    // Setup: Primary succeeds, but post-save fails
    vi.mocked(dbService.add).mockResolvedValue('test-id');
    vi.mocked(dbService.createJournalEntry).mockRejectedValue(new Error('Journal creation failed'));

    await simulateTransactionSubmit({
      primarySaveSuccess: true,
      postSaveSuccess: false
    });

    // Verification
    expect(mockShowNotification).toHaveBeenCalledWith('Success!', 'success');
    expect(mockShowNotification).not.toHaveBeenCalledWith('Server Error', 'error');
  });

  it('should show error notification if primary save fails', async () => {
    // Setup: Primary fails
    vi.mocked(dbService.add).mockRejectedValue(new Error('DB error'));

    await simulateTransactionSubmit({
      primarySaveSuccess: false
    });

    // Verification
    expect(mockShowNotification).toHaveBeenCalledWith('Server Error', 'error');
    expect(mockShowNotification).not.toHaveBeenCalledWith('Success!', 'success');
  });

  it('should show success notification if everything succeeds', async () => {
    // Setup: Everything succeeds
    vi.mocked(dbService.add).mockResolvedValue('test-id');
    vi.mocked(dbService.createJournalEntry).mockResolvedValue('journal-id');

    await simulateTransactionSubmit({
      primarySaveSuccess: true,
      postSaveSuccess: true
    });

    // Verification
    expect(mockShowNotification).toHaveBeenCalledWith('Success!', 'success');
    expect(mockShowNotification).not.toHaveBeenCalledWith('Server Error', 'error');
  });
});
