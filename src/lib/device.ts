/** Mã thiết bị sinh một lần, gửi kèm khi nộp nhãn để chống gian lận nhiều tài khoản một máy (mục 1). */
export function deviceId(): string {
  try {
    let id = window.localStorage.getItem("crowd.deviceId");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("crowd.deviceId", id);
    }
    return id;
  } catch {
    return "";
  }
}
