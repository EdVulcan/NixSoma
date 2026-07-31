export const observerClientKernelFileRefreshersScript = `async function refreshKernelFileOpenEvents() {
  try {
    const data = await fetchJson(observerConfig.systemSenseUrl + "/system/kernel/file-open-events");
    const readback = data.readback ?? {};
    const continuity = readback.continuity ?? {};
    kernelFileOpenStatus.textContent = data.status ?? "unknown";
    kernelFileOpenAvailable.textContent = String(Boolean(data.available));
    kernelFileOpenEventCount.textContent = String(data.eventCount ?? data.events?.length ?? 0);
    kernelFileOpenUniqueCommCount.textContent = String(readback.uniqueCommCount ?? 0);
    kernelFileOpenUniqueFlagCount.textContent = String(readback.uniqueFlagCount ?? 0);
    kernelFileOpenUniquePidCount.textContent = String(readback.uniquePidCount ?? 0);
    kernelFileOpenUniqueUidCount.textContent = String(readback.uniqueUidCount ?? 0);
    kernelFileOpenContinuityStatus.textContent = continuity.status ?? "unknown";
    kernelFileOpenCaptureSequence.textContent = String(continuity.captureSequence ?? "none");
    kernelFileOpenActivity.textContent = continuity.currentActivity ?? "unknown";
    kernelFileOpenNewCommCount.textContent = String(continuity.newCommCount ?? 0);
    kernelFileOpenReadbackJson.textContent = JSON.stringify(readback, null, 2);
    kernelFileOpenJson.textContent = JSON.stringify(data, null, 2);
  } catch {
    kernelFileOpenStatus.textContent = "offline";
    kernelFileOpenAvailable.textContent = "false";
    kernelFileOpenEventCount.textContent = "0";
    kernelFileOpenUniqueCommCount.textContent = "0";
    kernelFileOpenUniqueFlagCount.textContent = "0";
    kernelFileOpenUniquePidCount.textContent = "0";
    kernelFileOpenUniqueUidCount.textContent = "0";
    kernelFileOpenContinuityStatus.textContent = "offline";
    kernelFileOpenCaptureSequence.textContent = "none";
    kernelFileOpenActivity.textContent = "unknown";
    kernelFileOpenNewCommCount.textContent = "0";
    kernelFileOpenReadbackJson.textContent = "Unable to read kernel file-open summary.";
    kernelFileOpenJson.textContent = "Unable to read kernel file-open events.";
  }
}
`;
