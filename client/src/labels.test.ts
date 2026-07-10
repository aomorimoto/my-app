import { describe, it, expect } from "vitest";
import { memberLabel, STATUS_LABEL, PRIORITY_LABEL, ROLE_LABEL } from "./labels";

describe("labels", () => {
  it("memberLabel は name があれば name、無ければ username を返す", () => {
    expect(memberLabel({ name: "山田", username: "yamada" })).toBe("山田");
    expect(memberLabel({ name: null, username: "yamada" })).toBe("yamada");
  });

  it("ステータス/優先度/役割のラベルが日本語で対応する", () => {
    expect(STATUS_LABEL.TODO).toBe("未着手");
    expect(STATUS_LABEL.IN_PROGRESS).toBe("進行中");
    expect(STATUS_LABEL.DONE).toBe("完了");
    expect(PRIORITY_LABEL.HIGH).toBe("高");
    expect(ROLE_LABEL.OWNER).toBe("オーナー");
  });
});
