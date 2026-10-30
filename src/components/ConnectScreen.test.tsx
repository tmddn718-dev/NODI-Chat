// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectScreen } from "./ConnectScreen";

afterEach(cleanup);

describe("ConnectScreen demo mode", () => {
  it("offers a start button instead of an API key field and starts the demo", () => {
    const onStartDemo = vi.fn().mockResolvedValue(undefined);
    render(<ConnectScreen onConnect={vi.fn()} onStartDemo={onStartDemo} />);
    expect(screen.queryByLabelText("Groq API Key")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "데모 체험 시작하기" }));
    expect(onStartDemo).toHaveBeenCalledOnce();
  });

  it("keeps the API key form when demo is not offered", () => {
    render(<ConnectScreen onConnect={vi.fn()} />);
    expect(screen.getByLabelText("Groq API Key")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "데모 체험 시작하기" })).toBeNull();
  });
});
