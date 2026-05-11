import {
  BackendService,
  type BackendRankListResult,
  type BackendRankRecord,
  type BackendRankSubmitResult,
  type RankBoard,
} from '@/core/BackendService';

export type { BackendRankListResult as RankListResult, BackendRankRecord as RankRecord, RankBoard };

export const RANK_BOARD_BOWL: RankBoard = 'bowl_progress';
export const RANK_BOARD_FRUIT: RankBoard = 'fruit_best';

/** 由 RankUpload 调用时传入的玩家资料字段（昵称 / 头像 URL） */
export interface RankProfileFields {
  displayName?: string;
  avatarUrl?: string;
}

class RankServiceClass {
  get available(): boolean {
    return BackendService.available;
  }

  submitBowlProgress(level: number, badgeLevel: number, profile: RankProfileFields = {}): Promise<BackendRankSubmitResult> {
    return BackendService.submitRank({
      board: RANK_BOARD_BOWL,
      level: Math.max(0, Math.floor(level)),
      badgeLevel: Math.max(0, Math.floor(badgeLevel)),
      ...profile,
    });
  }

  submitFruitBest(score: number, profile: RankProfileFields = {}): Promise<BackendRankSubmitResult> {
    return BackendService.submitRank({
      board: RANK_BOARD_FRUIT,
      score: Math.max(0, Math.floor(score)),
      ...profile,
    });
  }

  list(board: RankBoard, limit = 50, offset = 0): Promise<BackendRankListResult> {
    return BackendService.listRank({ board, limit, offset });
  }
}

export const RankService = new RankServiceClass();
